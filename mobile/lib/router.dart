import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/auth/auth_controller.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/splash_screen.dart';
import 'features/beneficiaries/beneficiary_list_screen.dart';
import 'features/beneficiaries/beneficiary_register_screen.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/tasks/task_detail_screen.dart';
import 'features/tasks/task_list_screen.dart';
import 'shared/models/user.dart';

/// Single source of routing truth. Auth + role gating happen in `redirect`, keyed
/// off the auth controller's synchronous state — the mobile counterpart of the
/// web's RequireAuth/RequireRole guards (web/src/routes.tsx). The server still
/// enforces every permission; these gates only decide what the UI shows.
final routerProvider = Provider<GoRouter>((ref) {
  // Bridge Riverpod auth state into a Listenable so go_router re-evaluates
  // redirects on login/logout/session-expiry.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      // Still hydrating stored tokens → hold on the splash.
      if (auth.status == AuthStatus.unknown) {
        return loc == '/splash' ? null : '/splash';
      }

      final loggedIn = auth.status == AuthStatus.authenticated;
      if (!loggedIn) {
        return loc == '/login' ? null : '/login';
      }

      // Logged in but parked on login/splash → home.
      if (loc == '/login' || loc == '/splash') return '/dashboard';

      // Role gates (field roles only).
      final role = auth.user!.role;
      if (loc.startsWith('/beneficiaries/register') && !FieldRoles.canRegister(role)) {
        return '/dashboard';
      }
      if (loc.startsWith('/beneficiaries') && !FieldRoles.all.contains(role)) {
        return '/dashboard';
      }
      if (loc.startsWith('/tasks') && !FieldRoles.canViewTasks(role)) {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (c, s) => const SplashScreen()),
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/dashboard', builder: (c, s) => const DashboardScreen()),
      GoRoute(
        path: '/beneficiaries',
        builder: (c, s) => const BeneficiaryListScreen(),
        routes: [
          GoRoute(
            path: 'register',
            builder: (c, s) => const BeneficiaryRegisterScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/tasks',
        builder: (c, s) => const TaskListScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (c, s) => TaskDetailScreen(taskId: s.pathParameters['id']!),
          ),
        ],
      ),
    ],
  );
});
