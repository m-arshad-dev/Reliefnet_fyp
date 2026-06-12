import 'package:flutter/material.dart';

import '../models/beneficiary.dart';
import '../theme.dart';

/// The cross-NGO duplicate banner — a faithful port of the web amber banner in
/// web/src/features/beneficiaries/BeneficiariesPage.tsx. The flag FLAGS, never
/// blocks: the registration already succeeded; this just surfaces the masked
/// identity + prior aid so a human decides before delivering more.
class DuplicateBanner extends StatelessWidget {
  const DuplicateBanner(this.flag, {super.key});

  final DuplicateFlag flag;

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    final local = dt.toLocal();
    return '${local.day}/${local.month}/${local.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.amber50,
        border: Border.all(color: AppColors.amber300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '⚠ Possible duplicate — identity ${flag.maskedIdentity ?? ''}',
            style: const TextStyle(
              color: AppColors.amber900,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'This CNIC already has aid on record. Registration still succeeded — review the '
            'prior aid below before delivering more.',
            style: TextStyle(color: AppColors.amber800, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ...flag.priorAid.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text.rich(
                TextSpan(
                  style: const TextStyle(color: AppColors.amber800, fontSize: 14),
                  children: [
                    const TextSpan(text: '• '),
                    TextSpan(
                      text: p.ngo,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    TextSpan(text: ' — ${p.aidType}, ${_formatDate(p.deliveredAt)}'),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
