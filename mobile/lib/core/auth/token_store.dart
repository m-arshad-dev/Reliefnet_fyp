import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Where the access + refresh tokens live on the device. This is the mobile
/// counterpart of web/src/lib/auth/tokenStore.ts — same key names — but backed by
/// the platform keystore (`flutter_secure_storage`) instead of `localStorage`, so
/// tokens are encrypted at rest. Centralised so the dio interceptor and the auth
/// controller touch storage through one module.
class TokenStore {
  TokenStore(this._storage);

  static const _accessKey = 'reliefnet.accessToken';
  static const _refreshKey = 'reliefnet.refreshToken';

  final FlutterSecureStorage _storage;

  Future<String?> getAccess() => _storage.read(key: _accessKey);
  Future<String?> getRefresh() => _storage.read(key: _refreshKey);

  Future<void> setTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> setAccess(String access) => _storage.write(key: _accessKey, value: access);

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}

final tokenStoreProvider = Provider<TokenStore>((ref) {
  return TokenStore(const FlutterSecureStorage());
});
