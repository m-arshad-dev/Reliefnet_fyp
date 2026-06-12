// Slice 12 — the offline outbox DAO, exercised against an in-memory Drift database. This is the
// engine room of offline capture: every field write lands here (idempotency key + base), a drain
// reads it FIFO, and the server's per-op verdict (synced / conflict) flows back. Web resolution
// reconciles by client_uuid. No server, no emulator needed — pure local-DB behaviour.

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:reliefnet_mobile/core/db/app_database.dart';

void main() {
  late AppDatabase db;

  setUp(() => db = AppDatabase(NativeDatabase.memory()));
  tearDown(() => db.close());

  OutboxCompanion op(String clientUuid, {String? entityId, String? baseStatus}) {
    return OutboxCompanion.insert(
      clientUuid: clientUuid,
      entityType: 'task_transition',
      payload: '{"toStatus":"in_progress"}',
      clientCreatedAt: DateTime.now().toUtc().toIso8601String(),
      entityId: Value(entityId),
      baseStatus: Value(baseStatus),
    );
  }

  test('enqueued ops drain FIFO (capture order is replay order)', () async {
    await db.enqueueOutbox(op('a', entityId: 't1', baseStatus: 'assigned'));
    await db.enqueueOutbox(op('b', entityId: 't1', baseStatus: 'in_progress'));
    final pending = await db.pendingOutboxOps();
    expect(pending.map((o) => o.clientUuid).toList(), ['a', 'b']);
    expect(await db.watchOutboxCount('pending').first, 2);
  });

  test('markOutboxSynced removes an op from the pending drain', () async {
    await db.enqueueOutbox(op('a'));
    await db.markOutboxSynced('a');
    expect(await db.pendingOutboxOps(), isEmpty);
    expect(await db.watchOutboxCount('pending').first, 0);
  });

  test('a conflict feeds the badge, then reconciles by client_uuid when web resolves it', () async {
    await db.enqueueOutbox(op('a'));
    await db.markOutboxConflict('a');
    expect(await db.watchOutboxCount('conflict').first, 1);
    expect(await db.watchOutboxCount('pending').first, 0);

    // The web resolution re-enters the pull feed → the device clears it by client_uuid.
    await db.reconcileOutboxByClientUuid('a');
    expect(await db.watchOutboxCount('conflict').first, 0);
  });

  test('client_uuid is unique (idempotency key) — a duplicate enqueue throws', () async {
    await db.enqueueOutbox(op('dup'));
    expect(() => db.enqueueOutbox(op('dup')), throwsA(anything));
  });

  test('last_known_seq cursor round-trips (defaults to 0)', () async {
    expect(await db.getLastKnownSeq(), 0);
    await db.setLastKnownSeq(42);
    expect(await db.getLastKnownSeq(), 42);
  });
}
