import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../shared/models/beneficiary.dart';
import '../../shared/models/campaign.dart';
import '../../shared/models/task.dart';

part 'app_database.g.dart';

// Slice 11 sets up Drift but uses it ONLY as a thin read cache. The tables mirror
// the server shape; a SyncMeta row stores `last_known_seq` for Slice 12. There is
// NO outbox, NO offline write, NO sync engine here — that is Slice 12 (v2 §6.4).

class CachedBeneficiaries extends Table {
  TextColumn get id => text()();
  TextColumn get ngoId => text()();
  TextColumn get fullName => text()();
  IntColumn get householdSize => integer().nullable()();
  TextColumn get locationId => text().nullable()();
  TextColumn get contactMasked => text().nullable()();
  BoolColumn get verified => boolean()();
  TextColumn get verifiedBy => text().nullable()();
  TextColumn get registeredBy => text()();
  TextColumn get createdAt => text()();
  TextColumn get updatedAt => text()();

  @override
  Set<Column> get primaryKey => {id};
}

class CachedTasks extends Table {
  TextColumn get id => text()();
  TextColumn get ngoId => text()();
  TextColumn get campaignId => text()();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  TextColumn get locationId => text().nullable()();
  TextColumn get status => text()();
  IntColumn get rejectionCount => integer()();
  TextColumn get assignedTo => text().nullable()();
  TextColumn get createdBy => text()();
  TextColumn get createdAt => text()();
  TextColumn get updatedAt => text()();

  @override
  Set<Column> get primaryKey => {id};
}

class CachedCampaigns extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get status => text()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Single-row-per-key metadata. Holds `last_known_seq` (the server-assigned,
/// monotonic pull cursor) so Slice 12's sync engine has a starting point.
class SyncMeta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

/// Slice 12 — the offline OUTBOX (v2 §6.4). Every field write lands here first (with a
/// client_uuid idempotency key) alongside an optimistic cache write, and a background sync
/// worker drains it to POST /sync/push when online. `baseStatus` / `baseVerified` carry the
/// optimistic-concurrency base the server compares against to detect conflicts. `status`:
/// pending → synced (merged/duplicate) | conflict (parked for web resolution) | rejected.
class Outbox extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get clientUuid => text().unique()();
  TextColumn get entityType => text()(); // beneficiary | task_transition | beneficiary_verify
  TextColumn get entityId => text().nullable()(); // server entity (task / beneficiary) for transition & verify
  TextColumn get payload => text()(); // JSON of the domain fields
  TextColumn get baseStatus => text().nullable()(); // task status the device saw
  BoolColumn get baseVerified => boolean().nullable()(); // beneficiary.verified the device saw
  TextColumn get status => text().withDefault(const Constant('pending'))();
  TextColumn get clientCreatedAt => text()(); // ISO device clock (advisory only)
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
}

@DriftDatabase(tables: [CachedBeneficiaries, CachedTasks, CachedCampaigns, SyncMeta, Outbox])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? executor]) : super(executor ?? _openConnection());

  @override
  int get schemaVersion => 2;

  // Slice 12 adds the Outbox table on top of Slice 11's read-cache schema (v1).
  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) await m.createTable(outbox);
        },
      );

  static const _lastKnownSeqKey = 'last_known_seq';

  // --- Slice-12 cursor (stored now, consumed later) ---

  Future<int> getLastKnownSeq() async {
    final row = await (select(syncMeta)..where((t) => t.key.equals(_lastKnownSeqKey)))
        .getSingleOrNull();
    return row == null ? 0 : (int.tryParse(row.value) ?? 0);
  }

  Future<void> setLastKnownSeq(int seq) {
    return into(syncMeta).insertOnConflictUpdate(
      SyncMetaCompanion.insert(key: _lastKnownSeqKey, value: seq.toString()),
    );
  }

  // --- Beneficiary read cache (write-through after a successful fetch) ---

  Future<void> cacheBeneficiaries(List<Beneficiary> items) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(
        cachedBeneficiaries,
        items.map((x) => CachedBeneficiariesCompanion.insert(
              id: x.id,
              ngoId: x.ngoId,
              fullName: x.fullName,
              householdSize: Value(x.householdSize),
              locationId: Value(x.locationId),
              contactMasked: Value(x.contactMasked),
              verified: x.verified,
              verifiedBy: Value(x.verifiedBy),
              registeredBy: x.registeredBy,
              createdAt: x.createdAt,
              updatedAt: x.updatedAt,
            )),
      );
    });
  }

  /// Drop an optimistic local beneficiary row (its id is the client_uuid) once the canonical
  /// server row arrives on pull — otherwise the offline cache would show the person twice.
  Future<void> deleteCachedBeneficiary(String id) {
    return (delete(cachedBeneficiaries)..where((t) => t.id.equals(id))).go();
  }

  Future<List<Beneficiary>> cachedBeneficiariesFor(String ngoId) async {
    final rows = await (select(cachedBeneficiaries)
          ..where((t) => t.ngoId.equals(ngoId))
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .get();
    return rows
        .map((r) => Beneficiary(
              id: r.id,
              ngoId: r.ngoId,
              fullName: r.fullName,
              householdSize: r.householdSize,
              locationId: r.locationId,
              contactMasked: r.contactMasked,
              verified: r.verified,
              verifiedBy: r.verifiedBy,
              registeredBy: r.registeredBy,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            ))
        .toList();
  }

  // --- Task read cache ---

  Future<void> cacheTasks(List<Task> items) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(
        cachedTasks,
        items.map((x) => CachedTasksCompanion.insert(
              id: x.id,
              ngoId: x.ngoId,
              campaignId: x.campaignId,
              title: x.title,
              description: Value(x.description),
              locationId: Value(x.locationId),
              status: x.status,
              rejectionCount: x.rejectionCount,
              assignedTo: Value(x.assignedTo),
              createdBy: x.createdBy,
              createdAt: x.createdAt,
              updatedAt: x.updatedAt,
            )),
      );
    });
  }

  Future<List<Task>> cachedTasksFor(String ngoId) async {
    final rows = await (select(cachedTasks)
          ..where((t) => t.ngoId.equals(ngoId))
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .get();
    return rows
        .map((r) => Task(
              id: r.id,
              ngoId: r.ngoId,
              campaignId: r.campaignId,
              title: r.title,
              description: r.description,
              locationId: r.locationId,
              status: r.status,
              rejectionCount: r.rejectionCount,
              assignedTo: r.assignedTo,
              createdBy: r.createdBy,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            ))
        .toList();
  }

  // --- Slice 12 outbox (offline writes + sync worker) ---

  Future<void> enqueueOutbox(OutboxCompanion op) => into(outbox).insert(op);

  /// FIFO drain order — ops apply in the sequence they were captured, so a chain of
  /// transitions on one task (assigned→in_progress→pending_verification) replays correctly.
  Future<List<OutboxData>> pendingOutboxOps() {
    return (select(outbox)
          ..where((t) => t.status.equals('pending'))
          ..orderBy([(t) => OrderingTerm.asc(t.id)]))
        .get();
  }

  Future<void> _setOutboxStatus(String clientUuid, String status, {String? error}) {
    return (update(outbox)..where((t) => t.clientUuid.equals(clientUuid))).write(
      OutboxCompanion(
        status: Value(status),
        lastError: error == null ? const Value.absent() : Value(error),
      ),
    );
  }

  Future<void> markOutboxSynced(String clientUuid) => _setOutboxStatus(clientUuid, 'synced');
  Future<void> markOutboxConflict(String clientUuid) => _setOutboxStatus(clientUuid, 'conflict');
  Future<void> markOutboxRejected(String clientUuid, String error) =>
      _setOutboxStatus(clientUuid, 'rejected', error: error);

  /// A pulled merged/resolved op whose client_uuid matches one of our outbox rows means the
  /// server settled it (including a web-resolved conflict) — clear it so the badge updates.
  Future<void> reconcileOutboxByClientUuid(String clientUuid) {
    return (update(outbox)
          ..where((t) => t.clientUuid.equals(clientUuid) & t.status.equals('synced').not()))
        .write(const OutboxCompanion(status: Value('synced')));
  }

  Stream<int> watchOutboxCount(String status) {
    final q = selectOnly(outbox)
      ..addColumns([outbox.id.count()])
      ..where(outbox.status.equals(status));
    return q.map((row) => row.read(outbox.id.count()) ?? 0).watchSingle();
  }

  // --- Campaign picker cache ---

  Future<void> cacheCampaigns(List<Campaign> items) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(
        cachedCampaigns,
        items.map((x) => CachedCampaignsCompanion.insert(
              id: x.id,
              name: x.name,
              status: x.status,
            )),
      );
    });
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'reliefnet.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

/// One database for the app's lifetime.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
