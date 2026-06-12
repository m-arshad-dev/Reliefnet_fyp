import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/network/dio_client.dart';
import '../shared/models/location.dart';

class LocationRepository {
  LocationRepository(this._dio);

  final Dio _dio;

  /// GET /locations — shared reference data, any authenticated user may read it.
  /// Returns the whole bounded tree (no pagination).
  Future<List<AppLocation>> list() {
    return guardApi(() async {
      final res = await _dio.get<dynamic>('/locations');
      final items = res.data['data'] as List<dynamic>;
      return items.map((e) => AppLocation.fromJson(e as Map<String, dynamic>)).toList();
    });
  }
}

final locationRepositoryProvider = Provider<LocationRepository>((ref) {
  return LocationRepository(ref.watch(dioProvider));
});
