import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../core/db/app_database.dart';
import '../core/network/api_exception.dart';
import '../core/network/dio_client.dart';
import '../shared/models/page.dart';
import '../shared/models/task.dart';

class CreateTaskInput {
  CreateTaskInput({
    required this.title,
    required this.campaignId,
    this.description,
    this.locationId,
    this.assignedTo,
  });

  final String title;
  final String campaignId;
  final String? description;
  final String? locationId;
  final String? assignedTo;

  Map<String, dynamic> toJson() => {
        'title': title,
        'campaignId': campaignId,
        if (description != null && description!.isNotEmpty) 'description': description,
        'locationId': ?locationId,
        'assignedTo': ?assignedTo,
      };
}

class TaskRepository {
  TaskRepository(this._dio, this._db);

  final Dio _dio;
  final AppDatabase _db;
  static const _uuid = Uuid();

  Future<Page<Task>> list({String? status, String? assignedTo, int? limit, String? cursor}) {
    return guardApi(() async {
      final res = await _dio.get<dynamic>('/tasks', queryParameters: {
        'status': ?status,
        'assignedTo': ?assignedTo,
        'limit': ?limit,
        'cursor': ?cursor,
      });
      return Page.fromJson(res.data['data'] as Map<String, dynamic>, (j) => Task.fromJson(j));
    });
  }

  Future<Task> create(CreateTaskInput input) {
    return guardApi(() async {
      final res = await _dio.post<dynamic>('/tasks', data: input.toJson());
      return Task.fromJson(res.data['data'] as Map<String, dynamic>);
    });
  }

  /// Slice 12 — OFFLINE-FIRST transition (v2 §6.4). Optimistically advances the cached task
  /// (predicting the FSM + rejection-cap outcome locally) and queues a task_transition op
  /// carrying the BASE status the device saw. On sync the server compares that base to the
  /// current status: a match replays through the real FSM (legality/auth/cap re-enforced); a
  /// mismatch is parked as a conflict for web resolution. `assignedTo` is honoured only on assign
  /// edges. The server stays authoritative — a later pull corrects any optimistic divergence.
  Future<Task> transition(
    Task task, {
    required String toStatus,
    String? note,
    String? assignedTo,
    required String actorId,
  }) async {
    final clientUuid = _uuid.v4();
    final now = DateTime.now().toUtc().toIso8601String();
    final predicted = predictTransition(toStatus, task.rejectionCount);
    final optimistic = Task(
      id: task.id,
      ngoId: task.ngoId,
      campaignId: task.campaignId,
      title: task.title,
      description: task.description,
      locationId: task.locationId,
      status: predicted.status,
      rejectionCount: predicted.rejectionCount,
      assignedTo: assignedTo ?? task.assignedTo,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: now,
    );
    await _db.cacheTasks([optimistic]);
    await _db.enqueueOutbox(OutboxCompanion.insert(
      clientUuid: clientUuid,
      entityType: 'task_transition',
      payload: jsonEncode(<String, dynamic>{
        'toStatus': toStatus,
        if (note != null && note.isNotEmpty) 'note': note,
        'assignedTo': ?assignedTo,
      }),
      clientCreatedAt: now,
      entityId: Value(task.id),
      baseStatus: Value(task.status),
    ));
    return optimistic;
  }

  Future<Page<TaskTransition>> history(String taskId, {int? limit, String? cursor}) {
    return guardApi(() async {
      final res = await _dio.get<dynamic>('/tasks/$taskId/history', queryParameters: {
        'limit': ?limit,
        'cursor': ?cursor,
      });
      return Page.fromJson(
        res.data['data'] as Map<String, dynamic>,
        (j) => TaskTransition.fromJson(j),
      );
    });
  }
}

final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  return TaskRepository(ref.watch(dioProvider), ref.watch(appDatabaseProvider));
});
