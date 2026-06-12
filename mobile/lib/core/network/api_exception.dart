import 'package:dio/dio.dart';

/// A server- or transport-level error shaped for the UI. The API always answers
/// with `{ success, data, error }` (see api/src/middleware/errorHandler.ts), so
/// when a request fails we surface `error.code` / `error.message` verbatim —
/// that's how field users see "Beneficiary is already verified", a 403 message,
/// a 422 FSM rejection, etc.
class ApiException implements Exception {
  ApiException(this.code, this.message, [this.statusCode]);

  final String code;
  final String message;
  final int? statusCode;

  /// Map a dio failure onto our envelope. Falls back to a network message when
  /// there's no response body (server unreachable — the common field case).
  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      return ApiException(
        err['code']?.toString() ?? 'ERROR',
        err['message']?.toString() ?? 'Request failed',
        e.response?.statusCode,
      );
    }
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return ApiException(
          'NETWORK',
          'Cannot reach the server. Check the API is running and reachable.',
          null,
        );
      default:
        return ApiException('ERROR', e.message ?? 'Request failed', e.response?.statusCode);
    }
  }

  @override
  String toString() => message;
}

/// Run a dio call and normalise any [DioException] into an [ApiException]. Every
/// repository method funnels through this so screens only ever catch one type.
Future<T> guardApi<T>(Future<T> Function() fn) async {
  try {
    return await fn();
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}
