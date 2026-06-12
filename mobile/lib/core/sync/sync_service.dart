import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../db/app_database.dart';
import '../network/api_exception.dart';
import '../network/dio_client.dart';
import '../../shared/models/beneficiary.dart';
import '../../shared/models/task.dart';

/// Outcome of one sync pass. `reachedServer` false means the device was offline (ops stay
/// pending and will retry) — never a crash.
class SyncResult {
  const SyncResult({
    required this.reachedServer,
    required this.pushed,
    required this.pulled,
    this.error,
  });

  final bool reachedServer;
  final int pushed;
  final int pulled;
  final String? error;
}

/// Slice 12 — the mobile sync engine (v2 §6.4). Drains the local outbox to POST /sync/push,
/// then pulls server changes via `GET /sync/pull?since_seq=<cursor>` and hydrates the local
/// caches. Connectivity is MANUAL (no connectivity_plus): syncNow() runs on app launch and on a
/// "Sync now" tap; a network failure leaves ops pending and is swallowed into a SyncResult.
///
/// The device NEVER resolves conflicts — a push op that comes back `conflict` is parked locally
/// (it feeds the "N conflicts" badge) until a coordinator settles it on the web; the resolution
/// then re-enters the pull feed (re-stamped seq) and reconcileOutboxByClientUuid clears it here.
class SyncService {
  SyncService(this._dio, this._db);

  final Dio _dio;
  final AppDatabase _db;

  Future<SyncResult> syncNow() async {
    try {
      final pushed = await _drain();
      final pulled = await _pull();
      return SyncResult(reachedServer: true, pushed: pushed, pulled: pulled);
    } on DioException catch (e) {
      return SyncResult(
        reachedServer: false,
        pushed: 0,
        pulled: 0,
        error: ApiException.fromDio(e).message,
      );
    }
  }

  // Push every pending op in one idempotent batch; apply the per-op status back to the outbox.
  Future<int> _drain() async {
    final pending = await _db.pendingOutboxOps();
    if (pending.isEmpty) return 0;
    final res = await _dio.post<dynamic>('/sync/push', data: {
      'ops': pending.map(_toPushOp).toList(),
    });
    final results = (res.data['data']['results'] as List).cast<Map<String, dynamic>>();
    for (final r in results) {
      final cu = r['clientUuid'] as String;
      switch (r['status'] as String) {
        case 'merged':
        case 'duplicate':
          await _db.markOutboxSynced(cu);
        case 'conflict':
          await _db.markOutboxConflict(cu);
        case 'rejected':
          await _db.markOutboxRejected(cu, (r['reason'] as String?) ?? 'rejected by server');
      }
    }
    return results.length;
  }

  // Pull server changes since the stored cursor (seq-ordered) and hydrate the read caches.
  Future<int> _pull() async {
    final since = await _db.getLastKnownSeq();
    final res = await _dio.get<dynamic>('/sync/pull', queryParameters: {'since_seq': '$since'});
    final data = res.data['data'] as Map<String, dynamic>;
    final ops = (data['ops'] as List).cast<Map<String, dynamic>>();
    for (final op in ops) {
      await _hydrate(op);
      await _db.reconcileOutboxByClientUuid(op['clientUuid'] as String);
    }
    final maxSeq = int.tryParse('${data['maxSeq']}') ?? since;
    await _db.setLastKnownSeq(maxSeq);
    return ops.length;
  }

  Map<String, dynamic> _toPushOp(OutboxData o) => {
        'clientUuid': o.clientUuid,
        'entityType': o.entityType,
        'clientCreatedAt': o.clientCreatedAt,
        'payload': jsonDecode(o.payload),
        if (o.entityId != null) 'entityId': o.entityId,
        if (o.baseStatus != null) 'baseStatus': o.baseStatus,
        if (o.baseVerified != null) 'baseVerified': o.baseVerified,
      };

  Future<void> _hydrate(Map<String, dynamic> op) async {
    final result = op['result'] as Map<String, dynamic>?;
    if (result == null) return;
    switch (op['entityType'] as String) {
      case 'beneficiary':
        // register's result nests the beneficiary alongside the duplicateFlag. Drop the optimistic
        // local row (keyed by the op's client_uuid) before inserting the canonical server row, so
        // the same person isn't cached twice after a sync.
        await _db.deleteCachedBeneficiary(op['clientUuid'] as String);
        final b = (result['beneficiary'] ?? result) as Map<String, dynamic>;
        await _db.cacheBeneficiaries([Beneficiary.fromJson(b)]);
      case 'beneficiary_verify':
        await _db.cacheBeneficiaries([Beneficiary.fromJson(result)]);
      case 'task_transition':
        await _db.cacheTasks([Task.fromJson(result)]);
    }
  }
}

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(ref.watch(dioProvider), ref.watch(appDatabaseProvider));
});

/// Live count of outbox ops still waiting to reach the server (drives the dashboard badge).
final pendingSyncCountProvider = StreamProvider.autoDispose<int>((ref) {
  return ref.watch(appDatabaseProvider).watchOutboxCount('pending');
});

/// Live count of ops the server parked as conflicts — "resolve on web".
final conflictSyncCountProvider = StreamProvider.autoDispose<int>((ref) {
  return ref.watch(appDatabaseProvider).watchOutboxCount('conflict');
});
