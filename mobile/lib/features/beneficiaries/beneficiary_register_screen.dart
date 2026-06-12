import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/sync/sync_service.dart';
import '../../data/beneficiary_repository.dart';
import '../../data/campaign_repository.dart';
import '../../data/location_repository.dart';
import '../../shared/models/beneficiary.dart';
import '../../shared/models/location.dart';
import '../../shared/widgets/duplicate_banner.dart';
import 'beneficiary_list_screen.dart';

/// Optional region picker (GET /locations — shared reference data).
final locationsProvider = FutureProvider.autoDispose<List<AppLocation>>((ref) async {
  return ref.watch(locationRepositoryProvider).list();
});

/// Count digits the way the server normalises a CNIC (strip dashes/spaces).
int _digitCount(String s) => s.replaceAll(RegExp(r'\D'), '').length;

class BeneficiaryRegisterScreen extends ConsumerStatefulWidget {
  const BeneficiaryRegisterScreen({super.key});

  @override
  ConsumerState<BeneficiaryRegisterScreen> createState() => _BeneficiaryRegisterScreenState();
}

class _BeneficiaryRegisterScreenState extends ConsumerState<BeneficiaryRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _cnic = TextEditingController();
  final _fullName = TextEditingController();
  final _householdSize = TextEditingController();
  final _contactMasked = TextEditingController();

  String? _campaignId;
  String _aidType = aidTypes.first;
  String? _locationId;

  bool _submitting = false;
  bool _checking = false;
  String? _error;
  DuplicateFlag? _previewFlag; // from the optional pre-check
  RegisterBeneficiaryResult? _result; // from a successful registration

  @override
  void dispose() {
    _cnic.dispose();
    _fullName.dispose();
    _householdSize.dispose();
    _contactMasked.dispose();
    super.dispose();
  }

  Future<void> _preCheck() async {
    if (_digitCount(_cnic.text) != 13) {
      setState(() => _error = 'Enter a 13-digit CNIC before checking.');
      return;
    }
    setState(() {
      _checking = true;
      _error = null;
      _previewFlag = null;
      _result = null;
    });
    try {
      final flag = await ref.read(beneficiaryRepositoryProvider).checkDuplicate(_cnic.text.trim());
      setState(() => _previewFlag = flag);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_campaignId == null) {
      setState(() => _error = 'Select a campaign.');
      return;
    }
    final user = ref.read(authControllerProvider).user;
    if (user?.ngoId == null) {
      setState(() => _error = 'Your account is not scoped to an NGO.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _previewFlag = null;
      _result = null;
    });
    try {
      final input = RegisterBeneficiaryInput(
        cnic: _cnic.text.trim(),
        fullName: _fullName.text.trim(),
        campaignId: _campaignId!,
        aidType: _aidType,
        householdSize: _householdSize.text.trim().isEmpty
            ? null
            : int.tryParse(_householdSize.text.trim()),
        contactMasked: _contactMasked.text.trim().isEmpty ? null : _contactMasked.text.trim(),
        locationId: _locationId,
      );
      // Offline-first: writes to the local cache + outbox and returns instantly.
      final result = await ref
          .read(beneficiaryRepositoryProvider)
          .register(input, ngoId: user!.ngoId!, actorId: user.id);
      ref.invalidate(beneficiaryListProvider);
      setState(() {
        _result = result;
        // Clear the identity fields for the next entry; keep campaign/aidType.
        _cnic.clear();
        _fullName.clear();
        _householdSize.clear();
        _contactMasked.clear();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Saved ${result.beneficiary.fullName} — syncing…')),
        );
      }
      // Best-effort push now; offline leaves it queued for the next sync.
      final sync = await ref.read(syncServiceProvider).syncNow();
      if (mounted && !sync.reachedServer) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline — saved locally, will sync when connected.')),
        );
      } else {
        ref.invalidate(beneficiaryListProvider);
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
    final locationsAsync = ref.watch(locationsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Register beneficiary')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_previewFlag != null && _previewFlag!.flagged) ...[
                DuplicateBanner(_previewFlag!),
                const SizedBox(height: 16),
              ] else if (_previewFlag != null && !_previewFlag!.flagged) ...[
                _InfoNote('No prior aid on record for this CNIC.'),
                const SizedBox(height: 16),
              ] else if (_result != null) ...[
                _InfoNote('Saved on device — will sync to the server.', success: true),
                const SizedBox(height: 16),
              ],
              TextFormField(
                controller: _cnic,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'CNIC (13 digits, dashes optional)',
                  hintText: '12345-1234567-1',
                ),
                validator: (v) =>
                    _digitCount(v ?? '') == 13 ? null : 'CNIC must be 13 digits',
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _checking ? null : _preCheck,
                  icon: _checking
                      ? const SizedBox(
                          height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.search),
                  label: const Text('Check for duplicate'),
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _fullName,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Full name is required' : null,
              ),
              const SizedBox(height: 16),
              campaignsAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => _InfoNote(
                  e is ApiException ? e.message : 'Failed to load campaigns',
                  error: true,
                ),
                data: (campaigns) {
                  if (campaigns.isEmpty) {
                    return _InfoNote(
                      'No campaigns available. An NGO admin must create one (web) first.',
                      error: true,
                    );
                  }
                  return DropdownButtonFormField<String>(
                    initialValue: _campaignId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Campaign'),
                    items: campaigns
                        .map((c) => DropdownMenuItem(
                              value: c.id,
                              child: Text('${c.name} (${c.status})', overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _campaignId = v),
                    validator: (v) => v == null ? 'Select a campaign' : null,
                  );
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _aidType,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Aid type'),
                items: aidTypes
                    .map((a) => DropdownMenuItem(value: a, child: Text(a)))
                    .toList(),
                onChanged: (v) => setState(() => _aidType = v ?? _aidType),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _householdSize,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Household size (optional)'),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _contactMasked,
                decoration: const InputDecoration(labelText: 'Contact, masked (optional)'),
              ),
              const SizedBox(height: 16),
              locationsAsync.maybeWhen(
                data: (locations) {
                  final options = buildLocationOptions(locations);
                  return DropdownButtonFormField<String>(
                    initialValue: _locationId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Location (optional)'),
                    items: [
                      const DropdownMenuItem<String>(value: null, child: Text('—')),
                      ...options.map((o) => DropdownMenuItem(
                            value: o.id,
                            child: Text(o.label, overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: (v) => setState(() => _locationId = v),
                  );
                },
                orElse: () => const SizedBox.shrink(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Register'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoNote extends StatelessWidget {
  const _InfoNote(this.text, {this.error = false, this.success = false});

  final String text;
  final bool error;
  final bool success;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = error
        ? scheme.error
        : success
            ? Colors.green.shade700
            : scheme.outline;
    return Text(text, style: TextStyle(color: color));
  }
}
