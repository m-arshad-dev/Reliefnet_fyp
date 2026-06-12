import 'package:flutter/material.dart';

/// Shown while the auth controller hydrates the session from stored tokens
/// (status == unknown). The router swaps it for /login or /dashboard once known.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
