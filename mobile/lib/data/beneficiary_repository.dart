import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../core/db/app_database.dart';
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
  BeneficiaryRepository(this._dio, this._db);

  final Dio _dio;
  final AppDatabase _db;
  static const _uuid = Uuid();

  /// Slice 12 — OFFLINE-FIRST register (v2 §6.4). The write goes to the local Drift cache
  /// (optimistic UI) + the outbox (stamped with a client_uuid idempotency key) and returns
  /// instantly; the sync worker drains it to POST /beneficiaries' replay endpoint later. The
  /// cross-NGO duplicate flag is only known once the server processes the op — the screen's
  /// "Check for duplicate" pre-check covers the online case — so an unflagged placeholder is
  /// returned here. The raw CNIC sits in the on-device outbox until sync (the server still hashes
  /// + discards it; it never persists server-side), which is inherent to offline capture.
  Future<RegisterBeneficiaryResult> register(
    RegisterBeneficiaryInput input, {
    required String ngoId,
    required String actorId,
  }) async {
    final clientUuid = _uuid.v4();
    final now = DateTime.now().toUtc().toIso8601String();
    final optimistic = Beneficiary(
      id: clientUuid, // local id until the server assigns the real one on sync
      ngoId: ngoId,
      fullName: input.fullName,
      householdSize: input.householdSize,
      locationId: input.locationId,
      contactMasked: input.contactMasked,
      verified: false,
      verifiedBy: null,
      registeredBy: actorId,
      createdAt: now,
      updatedAt: now,
    );
    await _db.cacheBeneficiaries([optimistic]);
    await _db.enqueueOutbox(OutboxCompanion.insert(
      clientUuid: clientUuid,
      entityType: 'beneficiary',
      payload: jsonEncode(input.toJson()),
      clientCreatedAt: now,
    ));
    return RegisterBeneficiaryResult(
      beneficiary: optimistic,
      duplicateFlag: DuplicateFlag(flagged: false, maskedIdentity: null, priorAid: const []),
    );
  }

  /// POST /beneficiaries/check — pre-check. CNIC travels in the body (kept out of URLs/logs).
  /// An online-only read used to preview the duplicate flag before saving.
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

  /// Slice 12 — OFFLINE-FIRST verify. Optimistically flips the cached row to verified and queues
  /// a beneficiary_verify op carrying the base `verified` the device saw (so the server detects a
  /// conflict if another device verified meanwhile).
  Future<Beneficiary> verify(Beneficiary b, {required String actorId}) async {
    final clientUuid = _uuid.v4();
    final now = DateTime.now().toUtc().toIso8601String();
    final optimistic = Beneficiary(
      id: b.id,
      ngoId: b.ngoId,
      fullName: b.fullName,
      householdSize: b.householdSize,
      locationId: b.locationId,
      contactMasked: b.contactMasked,
      verified: true,
      verifiedBy: actorId,
      registeredBy: b.registeredBy,
      createdAt: b.createdAt,
      updatedAt: now,
    );
    await _db.cacheBeneficiaries([optimistic]);
    await _db.enqueueOutbox(OutboxCompanion.insert(
      clientUuid: clientUuid,
      entityType: 'beneficiary_verify',
      payload: jsonEncode(<String, dynamic>{}),
      clientCreatedAt: now,
      entityId: Value(b.id),
      baseVerified: Value(b.verified),
    ));
    return optimistic;
  }
}

final beneficiaryRepositoryProvider = Provider<BeneficiaryRepository>((ref) {
  return BeneficiaryRepository(ref.watch(dioProvider), ref.watch(appDatabaseProvider));
});
