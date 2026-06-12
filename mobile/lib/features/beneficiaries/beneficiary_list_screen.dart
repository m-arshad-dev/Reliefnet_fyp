import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/db/app_database.dart';
import '../../core/network/api_exception.dart';
import '../../data/beneficiary_repository.dart';
import '../../shared/models/beneficiary.dart';
import '../../shared/models/user.dart';
import '../../shared/widgets/status_badge.dart';

/// Beneficiary list (GET /beneficiaries). Write-through to the Drift cache on a
/// successful fetch; if the network is down and we have cached rows, fall back to
/// them (the thin read-cache role Drift plays this slice — no sync, no outbox).
final beneficiaryListProvider =
    FutureProvider.autoDispose<({List<Beneficiary> items, bool fromCache})>((ref) async {
  final repo = ref.watch(beneficiaryRepositoryProvider);
  final db = ref.watch(appDatabaseProvider);
  final ngoId = ref.read(authControllerProvider).user?.ngoId;
  try {
    final page = await repo.list(limit: 50);
    await db.cacheBeneficiaries(page.items);
    return (items: page.items, fromCache: false);
  } on ApiException catch (e) {
    if (e.code == 'NETWORK' && ngoId != null) {
      final cached = await db.cachedBeneficiariesFor(ngoId);
      if (cached.isNotEmpty) return (items: cached, fromCache: true);
    }
    rethrow;
  }
});

class BeneficiaryListScreen extends ConsumerWidget {
  const BeneficiaryListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authControllerProvider).user?.role ?? '';
    final canRegister = FieldRoles.canRegister(role);
    final async = ref.watch(beneficiaryListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Beneficiaries')),
      floatingActionButton: canRegister
          ? FloatingActionButton.extended(
              onPressed: () => context.go('/beneficiaries/register'),
              icon: const Icon(Icons.person_add_alt),
              label: const Text('Register'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(beneficiaryListProvider.future),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorList(
            message: e is ApiException ? e.message : 'Failed to load beneficiaries',
            onRetry: () => ref.invalidate(beneficiaryListProvider),
          ),
          data: (result) {
            if (result.items.isEmpty) {
              return const _CenteredScroll(
                child: Text('No beneficiaries registered yet.'),
              );
            }
            return ListView(
              children: [
                if (result.fromCache)
                  Container(
                    width: double.infinity,
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: const Text('Showing cached data — server unreachable.'),
                  ),
                ...result.items.map((b) => _BeneficiaryTile(beneficiary: b, canVerify: canRegister)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _BeneficiaryTile extends ConsumerStatefulWidget {
  const _BeneficiaryTile({required this.beneficiary, required this.canVerify});

  final Beneficiary beneficiary;
  final bool canVerify;

  @override
  ConsumerState<_BeneficiaryTile> createState() => _BeneficiaryTileState();
}

class _BeneficiaryTileState extends ConsumerState<_BeneficiaryTile> {
  bool _verifying = false;

  Future<void> _verify() async {
    setState(() => _verifying = true);
    try {
      await ref.read(beneficiaryRepositoryProvider).verify(widget.beneficiary.id);
      ref.invalidate(beneficiaryListProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.beneficiary;
    return ListTile(
      title: Text(b.fullName),
      subtitle: Text(b.householdSize != null ? 'Household of ${b.householdSize}' : '—'),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          StatusBadge(b.verified ? 'verified' : 'unverified'),
          if (widget.canVerify && !b.verified) ...[
            const SizedBox(width: 8),
            _verifying
                ? const SizedBox(
                    height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : TextButton(onPressed: _verify, child: const Text('Verify')),
          ],
        ],
      ),
    );
  }
}

class _ErrorList extends StatelessWidget {
  const _ErrorList({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _CenteredScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

/// A child centred but still scrollable, so RefreshIndicator works on empty/error.
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
