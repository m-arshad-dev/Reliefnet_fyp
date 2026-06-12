import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/sync/sync_service.dart';
import '../../data/task_repository.dart';
import '../../shared/models/task.dart';
import '../../shared/widgets/status_badge.dart';
import '../dashboard/dashboard_screen.dart';
import 'task_providers.dart';

/// Task detail + the FSM transition controls. Buttons render only legal next
/// states (taskTransitions) and are enabled only for the role that owns the edge
/// (canTransition) — the same per-edge logic api/src/services/task.service.ts
/// enforces. The server re-validates everything (422/403).
class TaskDetailScreen extends ConsumerStatefulWidget {
  const TaskDetailScreen({super.key, required this.taskId});

  final String taskId;

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  bool _working = false;

  Future<void> _transition(Task task, String to) async {
    final from = task.status;
    String? note;
    String? assignedTo;

    if (isAssignEdge(to)) {
      assignedTo = await _promptText(
        title: actionLabel(from, to),
        label: 'Assignee user UUID',
        requireValue: true,
      );
      if (assignedTo == null) return; // cancelled
    }
    if (to == 'rejected') {
      note = await _promptText(
        title: 'Reject task',
        label: 'Reason (optional)',
        requireValue: false,
      );
      if (note == null) return; // cancelled
      if (note.isEmpty) note = null;
    }

    final user = ref.read(authControllerProvider).user;
    if (user == null) return;

    setState(() => _working = true);
    try {
      // Offline-first: optimistic FSM advance + queued task_transition op (carries the base
      // status for server-side conflict detection).
      final updated = await ref.read(taskRepositoryProvider).transition(
            task,
            toStatus: to,
            note: note,
            assignedTo: assignedTo,
            actorId: user.id,
          );
      _invalidate();
      if (!mounted) return;
      if (to == 'rejected' && updated.status == 'escalated') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Rejection cap reached — escalated for coordinator review.'),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Moved to ${updated.status.replaceAll('_', ' ')} — syncing…')),
        );
      }
      // Best-effort push now; offline leaves it queued.
      final sync = await ref.read(syncServiceProvider).syncNow();
      if (mounted && sync.reachedServer) _invalidate();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  void _invalidate() {
    ref.invalidate(taskByIdProvider(widget.taskId));
    ref.invalidate(taskHistoryProvider(widget.taskId));
    ref.invalidate(taskListProvider);
    ref.invalidate(escalatedCountProvider);
  }

  Future<String?> _promptText({
    required String title,
    required String label,
    required bool requireValue,
  }) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            final canSubmit = !requireValue || controller.text.trim().isNotEmpty;
            return AlertDialog(
              title: Text(title),
              content: TextField(
                controller: controller,
                autofocus: true,
                decoration: InputDecoration(labelText: label),
                onChanged: (_) => setLocal(() {}),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: canSubmit
                      ? () => Navigator.of(ctx).pop(controller.text.trim())
                      : null,
                  child: const Text('Confirm'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authControllerProvider).user?.role ?? '';
    final taskAsync = ref.watch(taskByIdProvider(widget.taskId));

    return Scaffold(
      appBar: AppBar(title: const Text('Task')),
      body: taskAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(e is ApiException ? e.message : 'Failed to load task'),
        ),
        data: (task) {
          if (task == null) {
            return const Center(child: Text('Task not found.'));
          }
          return RefreshIndicator(
            onRefresh: () async => _invalidate(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        task.title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    StatusBadge(task.status),
                  ],
                ),
                if (task.description != null && task.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(task.description!),
                ],
                const SizedBox(height: 12),
                _MetaRow(label: 'Rejections', value: '${task.rejectionCount}'),
                _MetaRow(label: 'Assigned to', value: task.assignedTo ?? '—'),
                const SizedBox(height: 16),
                TransitionButtons(
                  task: task,
                  role: role,
                  working: _working,
                  onTransition: (to) => _transition(task, to),
                ),
                const Divider(height: 32),
                Text('History', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                _History(taskId: widget.taskId),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Renders the FSM transition controls for a task. Public (with the assignee/
/// note prompting lifted into the parent) so a widget test can assert that only
/// legal next states render and only the role that owns each edge can press it.
@visibleForTesting
class TransitionButtons extends StatelessWidget {
  const TransitionButtons({
    super.key,
    required this.task,
    required this.role,
    required this.working,
    required this.onTransition,
  });

  final Task task;
  final String role;
  final bool working;
  final void Function(String to) onTransition;

  @override
  Widget build(BuildContext context) {
    final nexts = taskTransitions[task.status] ?? const [];
    if (nexts.isEmpty) {
      return Text(
        'No further actions — this task is ${task.status.replaceAll('_', ' ')}.',
        style: TextStyle(color: Theme.of(context).colorScheme.outline),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: nexts.map((to) {
        final allowed = canTransition(role, task.status, to) && !working;
        final button = FilledButton.tonal(
          onPressed: allowed ? () => onTransition(to) : null,
          child: Text(actionLabel(task.status, to)),
        );
        // Disabled buttons still show, so a volunteer sees that verify/reject are a
        // coordinator action (and vice versa) rather than a missing control.
        return canTransition(role, task.status, to)
            ? button
            : Tooltip(message: 'Not permitted for your role', child: button);
      }).toList(),
    );
  }
}

class _History extends ConsumerWidget {
  const _History({required this.taskId});

  final String taskId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(taskHistoryProvider(taskId));
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(8),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Text(
        e is ApiException ? e.message : 'Failed to load history',
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
      data: (rows) {
        if (rows.isEmpty) return const Text('No history.');
        return Column(
          children: rows.map((t) {
            final from = t.fromStatus == null ? '∅' : t.fromStatus!.replaceAll('_', ' ');
            final to = t.toStatus.replaceAll('_', ' ');
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.arrow_right_alt),
              title: Text('$from → $to'),
              subtitle: t.note != null && t.note!.isNotEmpty ? Text(t.note!) : null,
            );
          }).toList(),
        );
      },
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: TextStyle(color: Theme.of(context).colorScheme.outline)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
