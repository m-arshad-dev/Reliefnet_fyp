import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../data/campaign_repository.dart';
import '../../data/task_repository.dart';
import '../dashboard/dashboard_screen.dart';
import 'task_providers.dart';

/// Coordinator-only: create a task (POST /tasks). assignedTo is an optional pasted
/// user UUID — the API has no GET /users for coordinators, so assignment takes a
/// raw id here (or is left blank and set later on the assign edge).
Future<void> showTaskCreateSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _TaskCreateForm(),
  );
}

class _TaskCreateForm extends ConsumerStatefulWidget {
  const _TaskCreateForm();

  @override
  ConsumerState<_TaskCreateForm> createState() => _TaskCreateFormState();
}

class _TaskCreateFormState extends ConsumerState<_TaskCreateForm> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _assignedTo = TextEditingController();
  String? _campaignId;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _assignedTo.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_campaignId == null) {
      setState(() => _error = 'Select a campaign.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(taskRepositoryProvider).create(CreateTaskInput(
            title: _title.text.trim(),
            campaignId: _campaignId!,
            description: _description.text.trim().isEmpty ? null : _description.text.trim(),
            assignedTo: _assignedTo.text.trim().isEmpty ? null : _assignedTo.text.trim(),
          ));
      ref.invalidate(taskListProvider);
      ref.invalidate(escalatedCountProvider);
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task created')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final campaignsAsync = ref.watch(campaignsProvider);
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('New task', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                controller: _title,
                decoration: const InputDecoration(labelText: 'Title'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _description,
                decoration: const InputDecoration(labelText: 'Description (optional)'),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              campaignsAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => Text(
                  e is ApiException ? e.message : 'Failed to load campaigns',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                data: (campaigns) {
                  if (campaigns.isEmpty) {
                    return Text(
                      'No campaigns available. Create one on the web first.',
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    );
                  }
                  return DropdownButtonFormField<String>(
                    initialValue: _campaignId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Campaign'),
                    items: campaigns
                        .map((c) => DropdownMenuItem(
                              value: c.id,
                              child: Text('${c.name} (${c.status})',
                                  overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _campaignId = v),
                    validator: (v) => v == null ? 'Select a campaign' : null,
                  );
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _assignedTo,
                decoration: const InputDecoration(
                  labelText: 'Assign to (user UUID, optional)',
                  helperText: 'Paste a volunteer\'s user id to pre-assign',
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Create task'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
