import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/db/app_database.dart';
import '../../data/task_repository.dart';
import '../../shared/models/task.dart';

/// Key for a task list query — coordinators filter by status (incl. 'escalated',
/// the stuck queue); volunteers scope to their own assigned tasks.
typedef TaskListKey = ({String? status, String? assignedTo});

/// GET /tasks with write-through to the Drift cache. The server is the source of
/// truth; the cache is a thin read aid this slice (no sync engine — Slice 12).
final taskListProvider =
    FutureProvider.autoDispose.family<List<Task>, TaskListKey>((ref, key) async {
  final page = await ref
      .watch(taskRepositoryProvider)
      .list(status: key.status, assignedTo: key.assignedTo, limit: 50);
  await ref.watch(appDatabaseProvider).cacheTasks(page.items);
  return page.items;
});

/// A single task's immutable transition history (GET /tasks/:id/history).
final taskHistoryProvider =
    FutureProvider.autoDispose.family<List<TaskTransition>, String>((ref, taskId) async {
  final page = await ref.watch(taskRepositoryProvider).history(taskId, limit: 100);
  return page.items;
});

/// One task by id, resolved from the most relevant list query (no GET /tasks/:id
/// endpoint exists). Refetched whenever a transition invalidates the lists.
final taskByIdProvider =
    FutureProvider.autoDispose.family<Task?, String>((ref, taskId) async {
  final page = await ref.watch(taskRepositoryProvider).list(limit: 100);
  for (final t in page.items) {
    if (t.id == taskId) return t;
  }
  return null;
});
