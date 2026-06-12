import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session_revision.dart';
import '../auth/token_store.dart';
import 'api_config.dart';

/// The configured dio instance every repository uses. This is a faithful port of
/// web/src/lib/api/client.ts:
///   - a request interceptor attaches `Authorization: Bearer <access>`;
///   - a response interceptor catches 401, refreshes once (single-flight), and
///     retries the original request with the new token;
///   - a failed refresh clears the tokens and bumps the session revision so the
///     router bounces to /login.
final dioProvider = Provider<Dio>((ref) {
  final tokenStore = ref.watch(tokenStoreProvider);

  final dio = Dio(BaseOptions(
    baseUrl: apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
    // Don't throw on 4xx here; repositories read the { success, data, error }
    // envelope and map failures to ApiException themselves.
    contentType: Headers.jsonContentType,
  ));

  // A bare dio (no interceptors) for the refresh round-trip — mirrors the web
  // client using plain axios so the refresh call can't recurse through the 401
  // handler below.
  final bareDio = Dio(BaseOptions(baseUrl: apiBaseUrl));

  final interceptor = _AuthInterceptor(
    dio: dio,
    bareDio: bareDio,
    tokenStore: tokenStore,
    onSessionExpired: () => ref.read(sessionRevisionProvider.notifier).expire(),
  );
  dio.interceptors.add(interceptor);

  return dio;
});

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor({
    required this.dio,
    required this.bareDio,
    required this.tokenStore,
    required this.onSessionExpired,
  });

  final Dio dio;
  final Dio bareDio;
  final TokenStore tokenStore;
  final void Function() onSessionExpired;

  // Single-flight: if several requests 401 at once they all await one refresh
  // round-trip rather than stampeding /auth/refresh (mirrors web's refreshPromise).
  Future<String?>? _refreshing;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await tokenStore.getAccess();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;
    final original = err.requestOptions;
    // Never try to refresh off the auth endpoints themselves: a 401 from
    // /auth/refresh means the refresh token is dead, and a 401 from /auth/login
    // means bad credentials — neither should trigger a refresh round-trip.
    final isAuthCall =
        original.path.contains('/auth/refresh') || original.path.contains('/auth/login');
    final alreadyRetried = original.extra['retried'] == true;

    if (response?.statusCode == 401 && !alreadyRetried && !isAuthCall) {
      final refreshToken = await tokenStore.getRefresh();
      if (refreshToken != null) {
        final newAccess = await _refresh();
        if (newAccess != null) {
          // Retry the original request once, with the fresh token.
          original.extra['retried'] = true;
          original.headers['Authorization'] = 'Bearer $newAccess';
          try {
            final retried = await dio.fetch<dynamic>(original);
            return handler.resolve(retried);
          } on DioException catch (e) {
            return handler.next(e);
          }
        }
      }
    }

    handler.next(err);
  }

  Future<String?> _refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _doRefresh() async {
    final refreshToken = await tokenStore.getRefresh();
    if (refreshToken == null) return null;
    try {
      final res = await bareDio.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final newAccess = res.data?['data']?['accessToken'] as String?;
      if (newAccess == null) throw Exception('No access token in refresh response');
      await tokenStore.setAccess(newAccess);
      return newAccess;
    } catch (_) {
      // Refresh failed → the session is dead. Clear and signal a logout.
      await tokenStore.clear();
      onSessionExpired();
      return null;
    }
  }
}
