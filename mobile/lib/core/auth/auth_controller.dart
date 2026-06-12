import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/auth_repository.dart';
import '../../shared/models/user.dart';
import 'session_revision.dart';
import 'token_store.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// The whole auth picture in one immutable value the router can read synchronously:
///   - `unknown`  — still hydrating from stored tokens (show a splash);
///   - `authenticated` — `user` is non-null, carries the role for nav gating;
///   - `unauthenticated` — bounce to /login.
class AuthState {
  const AuthState(this.status, this.user);
  const AuthState.unknown() : this(AuthStatus.unknown, null);
  const AuthState.unauthenticated() : this(AuthStatus.unauthenticated, null);
  const AuthState.authenticated(User user) : this(AuthStatus.authenticated, user);

  final AuthStatus status;
  final User? user;
}

/// Mirrors web/src/lib/auth/AuthContext.tsx: on start, if a token exists, hydrate
/// the user from /auth/me; expose login/logout; and react to involuntary session
/// death (a failed refresh bumps sessionRevisionProvider) by flipping to logged-out.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // The interceptor already cleared the tokens; we only need to flip state so
    // the router redirects to /login.
    ref.listen(sessionRevisionProvider, (prev, next) {
      if (prev != next && state.status != AuthStatus.unauthenticated) {
        state = const AuthState.unauthenticated();
      }
    });
    _hydrate();
    return const AuthState.unknown();
  }

  TokenStore get _tokenStore => ref.read(tokenStoreProvider);
  AuthRepository get _authRepo => ref.read(authRepositoryProvider);

  Future<void> _hydrate() async {
    final token = await _tokenStore.getAccess();
    if (token == null) {
      state = const AuthState.unauthenticated();
      return;
    }
    try {
      final user = await _authRepo.me();
      state = AuthState.authenticated(user);
    } catch (_) {
      await _tokenStore.clear();
      state = const AuthState.unauthenticated();
    }
  }

  Future<void> login(String email, String password) async {
    // Drop any stale tokens first so the login request carries no bearer and a
    // bad-credentials 401 can never trigger a refresh round-trip.
    await _tokenStore.clear();
    final result = await _authRepo.login(email, password);
    await _tokenStore.setTokens(result.accessToken, result.refreshToken);
    state = AuthState.authenticated(result.user);
  }

  Future<void> logout() async {
    await _tokenStore.clear();
    state = const AuthState.unauthenticated();
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
