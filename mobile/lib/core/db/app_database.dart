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

@DriftDatabase(tables: [CachedBeneficiaries, CachedTasks, CachedCampaigns, SyncMeta])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? executor]) : super(executor ?? _openConnection());

  @override
  int get schemaVersion => 1;

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
