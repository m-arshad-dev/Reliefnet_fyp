import 'package:flutter/material.dart';

/// Tailwind-ish palette, reused so the mobile client reads like the web Control
/// Center (same amber duplicate banner, same status colours).
class AppColors {
  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber300 = Color(0xFFFCD34D);
  static const amber800 = Color(0xFF92400E);
  static const amber900 = Color(0xFF78350F);

  static const emerald100 = Color(0xFFD1FAE5);
  static const emerald800 = Color(0xFF065F46);

  static const red100 = Color(0xFFFEE2E2);
  static const red800 = Color(0xFF991B1B);

  static const sky100 = Color(0xFFE0F2FE);
  static const sky800 = Color(0xFF075985);

  static const indigo100 = Color(0xFFE0E7FF);
  static const indigo800 = Color(0xFF3730A3);

  static const orange100 = Color(0xFFFFEDD5);
  static const orange800 = Color(0xFF9A3412);

  static const slate100 = Color(0xFFF1F5F9);
  static const slate700 = Color(0xFF334155);
}

ThemeData buildAppTheme() {
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1D4ED8)),
    useMaterial3: true,
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      isDense: true,
    ),
  );
}
