import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/db/app_database.dart';
import '../../core/network/api_exception.dart';
import '../../data/task_repository.dart';
import '../../shared/models/task.dart';

/// Key for a task list query — coordinators filter by status (incl. 'escalated',
/// the stuck queue); volunteers scope to their own assigned tasks.
typedef TaskListKey = ({String? status, String? assignedTo});

/// GET /tasks with write-through to the Drift cache. Slice 12: if the server is unreachable,
/// fall back to the cache (which carries optimistic offline writes) so a field user still sees
/// their work — the same NETWORK-fallback pattern the beneficiary list uses.
final taskListProvider =
    FutureProvider.autoDispose.family<List<Task>, TaskListKey>((ref, key) async {
  final db = ref.watch(appDatabaseProvider);
  final ngoId = ref.read(authControllerProvider).user?.ngoId;
  try {
    final page = await ref
        .watch(taskRepositoryProvider)
        .list(status: key.status, assignedTo: key.assignedTo, limit: 50);
    await db.cacheTasks(page.items);
    return page.items;
  } on ApiException catch (e) {
    if (e.code == 'NETWORK' && ngoId != null) {
      var items = await db.cachedTasksFor(ngoId);
      if (key.status != null) items = items.where((t) => t.status == key.status).toList();
      if (key.assignedTo != null) items = items.where((t) => t.assignedTo == key.assignedTo).toList();
      return items;
    }
    rethrow;
  }
});

/// A single task's immutable transition history (GET /tasks/:id/history).
final taskHistoryProvider =
    FutureProvider.autoDispose.family<List<TaskTransition>, String>((ref, taskId) async {
  final page = await ref.watch(taskRepositoryProvider).history(taskId, limit: 100);
  return page.items;
});

/// One task by id, resolved from the most relevant list query (no GET /tasks/:id
/// endpoint exists). Refetched whenever a transition invalidates the lists. Slice 12: falls
/// back to the Drift cache offline so an optimistically-transitioned task is still readable.
final taskByIdProvider =
    FutureProvider.autoDispose.family<Task?, String>((ref, taskId) async {
  final db = ref.watch(appDatabaseProvider);
  final ngoId = ref.read(authControllerProvider).user?.ngoId;
  List<Task> items;
  try {
    final page = await ref.watch(taskRepositoryProvider).list(limit: 100);
    await db.cacheTasks(page.items);
    items = page.items;
  } on ApiException catch (e) {
    if (e.code == 'NETWORK' && ngoId != null) {
      items = await db.cachedTasksFor(ngoId);
    } else {
      rethrow;
    }
  }
  for (final t in items) {
    if (t.id == taskId) return t;
  }
  return null;
});
