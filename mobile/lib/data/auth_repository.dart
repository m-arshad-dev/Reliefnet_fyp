import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/network/dio_client.dart';
import '../shared/models/user.dart';

/// Result of POST /auth/login — the tokens plus the signed-in user.
class LoginResult {
  LoginResult({required this.accessToken, required this.refreshToken, required this.user});

  final String accessToken;
  final String refreshToken;
  final User user;
}

class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Future<LoginResult> login(String email, String password) {
    return guardApi(() async {
      final res = await _dio.post<dynamic>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      final data = res.data['data'] as Map<String, dynamic>;
      return LoginResult(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
        user: User.fromJson(data['user'] as Map<String, dynamic>),
      );
    });
  }

  Future<User> me() {
    return guardApi(() async {
      final res = await _dio.get<dynamic>('/auth/me');
      final data = res.data['data'] as Map<String, dynamic>;
      return User.fromJson(data['user'] as Map<String, dynamic>);
    });
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(dioProvider));
});
