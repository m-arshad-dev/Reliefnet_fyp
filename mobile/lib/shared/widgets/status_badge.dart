import 'package:flutter/material.dart';

import '../theme.dart';

/// Status pill — the mobile counterpart of web/src/components/ui/badge.tsx. Known
/// statuses get colour-coded; anything else falls back to a neutral chip. Underscores
/// render as spaces, capitalised, exactly like the web badge.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});

  final String status;

  static const _styles = <String, (Color bg, Color fg)>{
    // Task FSM
    'created': (AppColors.slate100, AppColors.slate700),
    'assigned': (AppColors.indigo100, AppColors.indigo800),
    'in_progress': (AppColors.sky100, AppColors.sky800),
    'pending_verification': (AppColors.amber100, AppColors.amber800),
    'completed': (AppColors.emerald100, AppColors.emerald800),
    'rejected': (AppColors.red100, AppColors.red800),
    'escalated': (AppColors.orange100, AppColors.orange800),
    // Beneficiary verification
    'verified': (AppColors.emerald100, AppColors.emerald800),
    'unverified': (AppColors.slate100, AppColors.slate700),
  };

  @override
  Widget build(BuildContext context) {
    final style = _styles[status] ?? (AppColors.slate100, AppColors.slate700);
    final label = status
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: style.$1,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: style.$2, fontSize: 12, fontWeight: FontWeight.w500),
      ),
    );
  }
}
