import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../data/task_repository.dart';
import '../../shared/models/user.dart';

/// How many tasks are stuck in `escalated` (3+ rejections) — the coordinator's
/// stuck-task queue. Only fetched for coordinators (the others can't read it
/// meaningfully and it just lights the Tasks tile).
final escalatedCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final page = await ref.watch(taskRepositoryProvider).list(status: 'escalated');
  return page.items.length;
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('RELIEFNET Field'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: user == null
          ? const SizedBox.shrink()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _UserCard(user: user),
                const SizedBox(height: 16),
                ..._tilesFor(context, ref, user),
              ],
            ),
    );
  }

  List<Widget> _tilesFor(BuildContext context, WidgetRef ref, User user) {
    final role = user.role;
    final tiles = <Widget>[];

    if (FieldRoles.all.contains(role)) {
      tiles.add(_NavTile(
        icon: Icons.people_alt_outlined,
        title: 'Beneficiaries',
        subtitle: FieldRoles.canRegister(role)
            ? 'Register + verify, cross-NGO duplicate check'
            : 'View registered beneficiaries',
        onTap: () => context.go('/beneficiaries'),
      ));
    }

    if (FieldRoles.canViewTasks(role)) {
      final escalated = role == FieldRoles.fieldCoordinator
          ? ref.watch(escalatedCountProvider).maybeWhen(data: (n) => n, orElse: () => 0)
          : 0;
      tiles.add(_NavTile(
        icon: Icons.checklist_outlined,
        title: 'Tasks',
        subtitle: role == FieldRoles.volunteer
            ? 'Your assigned tasks — execute & submit'
            : 'Assign, verify, and clear escalations',
        badgeCount: escalated,
        onTap: () => context.go('/tasks'),
      ));
    }

    if (tiles.isEmpty) {
      tiles.add(
        const Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'No field screens for this role. Use the web Control Center for '
              'admin, analytics, and audit.',
            ),
          ),
        ),
      );
    }

    return tiles;
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Text(
            user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : '?',
          ),
        ),
        title: Text(user.fullName),
        subtitle: Text('${user.email}\n${user.role.replaceAll('_', ' ')}'),
        isThreeLine: true,
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badgeCount = 0,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, size: 32),
        title: Row(
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            if (badgeCount > 0) ...[
              const SizedBox(width: 8),
              _EscalatedBadge(count: badgeCount),
            ],
          ],
        ),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _EscalatedBadge extends StatelessWidget {
  const _EscalatedBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.error,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$count escalated',
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
