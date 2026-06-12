import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../shared/models/task.dart';
import '../../shared/models/user.dart';
import '../../shared/widgets/status_badge.dart';
import 'task_create_sheet.dart';
import 'task_providers.dart';

/// Coordinator status filters — 'escalated' is the stuck-task queue (3+ rejections).
const _statusFilters = [
  null,
  'created',
  'assigned',
  'in_progress',
  'pending_verification',
  'completed',
  'rejected',
  'escalated',
];

class TaskListScreen extends ConsumerStatefulWidget {
  const TaskListScreen({super.key});

  @override
  ConsumerState<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends ConsumerState<TaskListScreen> {
  String? _status; // coordinator status filter; null = all

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) return const SizedBox.shrink();
    final isVolunteer = user.role == FieldRoles.volunteer;
    final isCoordinator = user.role == FieldRoles.fieldCoordinator;

    // Volunteers see only their own tasks; coordinators see all, filterable.
    final TaskListKey key = isVolunteer
        ? (status: null, assignedTo: user.id)
        : (status: _status, assignedTo: null);
    final async = ref.watch(taskListProvider(key));

    return Scaffold(
      appBar: AppBar(title: Text(isVolunteer ? 'My tasks' : 'Tasks')),
      floatingActionButton: isCoordinator
          ? FloatingActionButton.extended(
              onPressed: () => showTaskCreateSheet(context),
              icon: const Icon(Icons.add_task),
              label: const Text('New task'),
            )
          : null,
      body: Column(
        children: [
          if (isCoordinator)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _statusFilters.map((s) {
                    final selected = s == _status;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(s == null ? 'All' : s.replaceAll('_', ' ')),
                        selected: selected,
                        onSelected: (_) => setState(() => _status = s),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.refresh(taskListProvider(key).future),
              child: async.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => _CenteredScroll(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(e is ApiException ? e.message : 'Failed to load tasks',
                          textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () => ref.invalidate(taskListProvider(key)),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
                data: (tasks) {
                  if (tasks.isEmpty) {
                    return const _CenteredScroll(child: Text('No tasks here.'));
                  }
                  return ListView.separated(
                    itemCount: tasks.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) => _TaskTile(task: tasks[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task});

  final Task task;

  @override
  Widget build(BuildContext context) {
    final rejections = task.rejectionCount > 0
        ? ' · ${task.rejectionCount} rejection${task.rejectionCount == 1 ? '' : 's'}'
        : '';
    return ListTile(
      title: Text(task.title),
      subtitle: Text('${task.status.replaceAll('_', ' ')}$rejections'),
      trailing: StatusBadge(task.status),
      onTap: () => context.go('/tasks/${task.id}'),
    );
  }
}

class _CenteredScroll extends StatelessWidget {
  const _CenteredScroll({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(child: Padding(padding: const EdgeInsets.all(24), child: child)),
        ),
      ),
    );
  }
}
