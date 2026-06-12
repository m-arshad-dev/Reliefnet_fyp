import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  TaskRepository(this._dio);

  final Dio _dio;

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

  /// PATCH /tasks/:id/transition. `assignedTo` is honoured only on the assign edges
  /// (the service ignores it elsewhere). FSM legality (422), per-edge auth (403) and
  /// the rejection cap → escalation all live server-side.
  Future<Task> transition(
    String id, {
    required String toStatus,
    String? note,
    String? assignedTo,
  }) {
    return guardApi(() async {
      final res = await _dio.patch<dynamic>('/tasks/$id/transition', data: {
        'toStatus': toStatus,
        if (note != null && note.isNotEmpty) 'note': note,
        'assignedTo': ?assignedTo,
      });
      return Task.fromJson(res.data['data'] as Map<String, dynamic>);
    });
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
  return TaskRepository(ref.watch(dioProvider));
});
