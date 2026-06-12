import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/network/dio_client.dart';
import '../shared/models/beneficiary.dart';
import '../shared/models/page.dart';

/// Fields the registration form sends. The NGO is forced from the JWT server-side
/// (never the body); the CNIC is hashed + discarded server-side and never stored.
class RegisterBeneficiaryInput {
  RegisterBeneficiaryInput({
    required this.cnic,
    required this.fullName,
    required this.campaignId,
    required this.aidType,
    this.householdSize,
    this.contactMasked,
    this.locationId,
  });

  final String cnic;
  final String fullName;
  final String campaignId;
  final String aidType;
  final int? householdSize;
  final String? contactMasked;
  final String? locationId;

  Map<String, dynamic> toJson() => {
        'cnic': cnic,
        'fullName': fullName,
        'campaignId': campaignId,
        'aidType': aidType,
        'householdSize': ?householdSize,
        if (contactMasked != null && contactMasked!.isNotEmpty) 'contactMasked': contactMasked,
        'locationId': ?locationId,
      };
}

class BeneficiaryRepository {
  BeneficiaryRepository(this._dio);

  final Dio _dio;

  /// POST /beneficiaries — always 201; the response nests the duplicateFlag.
  Future<RegisterBeneficiaryResult> register(RegisterBeneficiaryInput input) {
    return guardApi(() async {
      final res = await _dio.post<dynamic>('/beneficiaries', data: input.toJson());
      return RegisterBeneficiaryResult.fromJson(res.data['data'] as Map<String, dynamic>);
    });
  }

  /// POST /beneficiaries/check — pre-check. CNIC travels in the body (kept out of URLs/logs).
  Future<DuplicateFlag> checkDuplicate(String cnic) {
    return guardApi(() async {
      final res = await _dio.post<dynamic>('/beneficiaries/check', data: {'cnic': cnic});
      return DuplicateFlag.fromJson(res.data['data'] as Map<String, dynamic>);
    });
  }

  Future<Page<Beneficiary>> list({bool? verified, int? limit, String? cursor}) {
    return guardApi(() async {
      final res = await _dio.get<dynamic>('/beneficiaries', queryParameters: {
        'verified': ?verified,
        'limit': ?limit,
        'cursor': ?cursor,
      });
      return Page.fromJson(
        res.data['data'] as Map<String, dynamic>,
        (j) => Beneficiary.fromJson(j),
      );
    });
  }

  Future<Beneficiary> verify(String id) {
    return guardApi(() async {
      final res = await _dio.patch<dynamic>('/beneficiaries/$id/verify', data: {});
      return Beneficiary.fromJson(res.data['data'] as Map<String, dynamic>);
    });
  }
}

final beneficiaryRepositoryProvider = Provider<BeneficiaryRepository>((ref) {
  return BeneficiaryRepository(ref.watch(dioProvider));
});
