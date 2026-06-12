import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/db/app_database.dart';
import '../core/network/api_exception.dart';
import '../core/network/dio_client.dart';
import '../shared/models/campaign.dart';
import '../shared/models/page.dart';

class CampaignRepository {
  CampaignRepository(this._dio);

  final Dio _dio;

  /// GET /campaigns — only field_coordinator (+ ngo_admin) hold campaign:read, so
  /// this backs the registration screen's campaign picker for the coordinator.
  Future<Page<Campaign>> list({String? disasterId, int? limit, String? cursor}) {
    return guardApi(() async {
      final res = await _dio.get<dynamic>('/campaigns', queryParameters: {
        'disasterId': ?disasterId,
        'limit': ?limit,
        'cursor': ?cursor,
      });
      return Page.fromJson(res.data['data'] as Map<String, dynamic>, (j) => Campaign.fromJson(j));
    });
  }
}

final campaignRepositoryProvider = Provider<CampaignRepository>((ref) {
  return CampaignRepository(ref.watch(dioProvider));
});

/// Campaigns for the registration + task-create pickers, write-through to the
/// Drift cache. Coordinator-only (campaign:read).
final campaignsProvider = FutureProvider.autoDispose<List<Campaign>>((ref) async {
  final page = await ref.watch(campaignRepositoryProvider).list(limit: 100);
  await ref.watch(appDatabaseProvider).cacheCampaigns(page.items);
  return page.items;
});
