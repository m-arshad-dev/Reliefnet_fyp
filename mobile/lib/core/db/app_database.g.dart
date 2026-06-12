// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $CachedBeneficiariesTable extends CachedBeneficiaries
    with TableInfo<$CachedBeneficiariesTable, CachedBeneficiary> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedBeneficiariesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ngoIdMeta = const VerificationMeta('ngoId');
  @override
  late final GeneratedColumn<String> ngoId = GeneratedColumn<String>(
    'ngo_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fullNameMeta = const VerificationMeta(
    'fullName',
  );
  @override
  late final GeneratedColumn<String> fullName = GeneratedColumn<String>(
    'full_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _householdSizeMeta = const VerificationMeta(
    'householdSize',
  );
  @override
  late final GeneratedColumn<int> householdSize = GeneratedColumn<int>(
    'household_size',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationIdMeta = const VerificationMeta(
    'locationId',
  );
  @override
  late final GeneratedColumn<String> locationId = GeneratedColumn<String>(
    'location_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _contactMaskedMeta = const VerificationMeta(
    'contactMasked',
  );
  @override
  late final GeneratedColumn<String> contactMasked = GeneratedColumn<String>(
    'contact_masked',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _verifiedMeta = const VerificationMeta(
    'verified',
  );
  @override
  late final GeneratedColumn<bool> verified = GeneratedColumn<bool>(
    'verified',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("verified" IN (0, 1))',
    ),
  );
  static const VerificationMeta _verifiedByMeta = const VerificationMeta(
    'verifiedBy',
  );
  @override
  late final GeneratedColumn<String> verifiedBy = GeneratedColumn<String>(
    'verified_by',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _registeredByMeta = const VerificationMeta(
    'registeredBy',
  );
  @override
  late final GeneratedColumn<String> registeredBy = GeneratedColumn<String>(
    'registered_by',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<String> createdAt = GeneratedColumn<String>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    ngoId,
    fullName,
    householdSize,
    locationId,
    contactMasked,
    verified,
    verifiedBy,
    registeredBy,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_beneficiaries';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedBeneficiary> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('ngo_id')) {
      context.handle(
        _ngoIdMeta,
        ngoId.isAcceptableOrUnknown(data['ngo_id']!, _ngoIdMeta),
      );
    } else if (isInserting) {
      context.missing(_ngoIdMeta);
    }
    if (data.containsKey('full_name')) {
      context.handle(
        _fullNameMeta,
        fullName.isAcceptableOrUnknown(data['full_name']!, _fullNameMeta),
      );
    } else if (isInserting) {
      context.missing(_fullNameMeta);
    }
    if (data.containsKey('household_size')) {
      context.handle(
        _householdSizeMeta,
        householdSize.isAcceptableOrUnknown(
          data['household_size']!,
          _householdSizeMeta,
        ),
      );
    }
    if (data.containsKey('location_id')) {
      context.handle(
        _locationIdMeta,
        locationId.isAcceptableOrUnknown(data['location_id']!, _locationIdMeta),
      );
    }
    if (data.containsKey('contact_masked')) {
      context.handle(
        _contactMaskedMeta,
        contactMasked.isAcceptableOrUnknown(
          data['contact_masked']!,
          _contactMaskedMeta,
        ),
      );
    }
    if (data.containsKey('verified')) {
      context.handle(
        _verifiedMeta,
        verified.isAcceptableOrUnknown(data['verified']!, _verifiedMeta),
      );
    } else if (isInserting) {
      context.missing(_verifiedMeta);
    }
    if (data.containsKey('verified_by')) {
      context.handle(
        _verifiedByMeta,
        verifiedBy.isAcceptableOrUnknown(data['verified_by']!, _verifiedByMeta),
      );
    }
    if (data.containsKey('registered_by')) {
      context.handle(
        _registeredByMeta,
        registeredBy.isAcceptableOrUnknown(
          data['registered_by']!,
          _registeredByMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_registeredByMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedBeneficiary map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedBeneficiary(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      ngoId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ngo_id'],
      )!,
      fullName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}full_name'],
      )!,
      householdSize: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}household_size'],
      ),
      locationId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location_id'],
      ),
      contactMasked: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}contact_masked'],
      ),
      verified: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}verified'],
      )!,
      verifiedBy: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}verified_by'],
      ),
      registeredBy: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}registered_by'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $CachedBeneficiariesTable createAlias(String alias) {
    return $CachedBeneficiariesTable(attachedDatabase, alias);
  }
}

class CachedBeneficiary extends DataClass
    implements Insertable<CachedBeneficiary> {
  final String id;
  final String ngoId;
  final String fullName;
  final int? householdSize;
  final String? locationId;
  final String? contactMasked;
  final bool verified;
  final String? verifiedBy;
  final String registeredBy;
  final String createdAt;
  final String updatedAt;
  const CachedBeneficiary({
    required this.id,
    required this.ngoId,
    required this.fullName,
    this.householdSize,
    this.locationId,
    this.contactMasked,
    required this.verified,
    this.verifiedBy,
    required this.registeredBy,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['ngo_id'] = Variable<String>(ngoId);
    map['full_name'] = Variable<String>(fullName);
    if (!nullToAbsent || householdSize != null) {
      map['household_size'] = Variable<int>(householdSize);
    }
    if (!nullToAbsent || locationId != null) {
      map['location_id'] = Variable<String>(locationId);
    }
    if (!nullToAbsent || contactMasked != null) {
      map['contact_masked'] = Variable<String>(contactMasked);
    }
    map['verified'] = Variable<bool>(verified);
    if (!nullToAbsent || verifiedBy != null) {
      map['verified_by'] = Variable<String>(verifiedBy);
    }
    map['registered_by'] = Variable<String>(registeredBy);
    map['created_at'] = Variable<String>(createdAt);
    map['updated_at'] = Variable<String>(updatedAt);
    return map;
  }

  CachedBeneficiariesCompanion toCompanion(bool nullToAbsent) {
    return CachedBeneficiariesCompanion(
      id: Value(id),
      ngoId: Value(ngoId),
      fullName: Value(fullName),
      householdSize: householdSize == null && nullToAbsent
          ? const Value.absent()
          : Value(householdSize),
      locationId: locationId == null && nullToAbsent
          ? const Value.absent()
          : Value(locationId),
      contactMasked: contactMasked == null && nullToAbsent
          ? const Value.absent()
          : Value(contactMasked),
      verified: Value(verified),
      verifiedBy: verifiedBy == null && nullToAbsent
          ? const Value.absent()
          : Value(verifiedBy),
      registeredBy: Value(registeredBy),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory CachedBeneficiary.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedBeneficiary(
      id: serializer.fromJson<String>(json['id']),
      ngoId: serializer.fromJson<String>(json['ngoId']),
      fullName: serializer.fromJson<String>(json['fullName']),
      householdSize: serializer.fromJson<int?>(json['householdSize']),
      locationId: serializer.fromJson<String?>(json['locationId']),
      contactMasked: serializer.fromJson<String?>(json['contactMasked']),
      verified: serializer.fromJson<bool>(json['verified']),
      verifiedBy: serializer.fromJson<String?>(json['verifiedBy']),
      registeredBy: serializer.fromJson<String>(json['registeredBy']),
      createdAt: serializer.fromJson<String>(json['createdAt']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ngoId': serializer.toJson<String>(ngoId),
      'fullName': serializer.toJson<String>(fullName),
      'householdSize': serializer.toJson<int?>(householdSize),
      'locationId': serializer.toJson<String?>(locationId),
      'contactMasked': serializer.toJson<String?>(contactMasked),
      'verified': serializer.toJson<bool>(verified),
      'verifiedBy': serializer.toJson<String?>(verifiedBy),
      'registeredBy': serializer.toJson<String>(registeredBy),
      'createdAt': serializer.toJson<String>(createdAt),
      'updatedAt': serializer.toJson<String>(updatedAt),
    };
  }

  CachedBeneficiary copyWith({
    String? id,
    String? ngoId,
    String? fullName,
    Value<int?> householdSize = const Value.absent(),
    Value<String?> locationId = const Value.absent(),
    Value<String?> contactMasked = const Value.absent(),
    bool? verified,
    Value<String?> verifiedBy = const Value.absent(),
    String? registeredBy,
    String? createdAt,
    String? updatedAt,
  }) => CachedBeneficiary(
    id: id ?? this.id,
    ngoId: ngoId ?? this.ngoId,
    fullName: fullName ?? this.fullName,
    householdSize: householdSize.present
        ? householdSize.value
        : this.householdSize,
    locationId: locationId.present ? locationId.value : this.locationId,
    contactMasked: contactMasked.present
        ? contactMasked.value
        : this.contactMasked,
    verified: verified ?? this.verified,
    verifiedBy: verifiedBy.present ? verifiedBy.value : this.verifiedBy,
    registeredBy: registeredBy ?? this.registeredBy,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  CachedBeneficiary copyWithCompanion(CachedBeneficiariesCompanion data) {
    return CachedBeneficiary(
      id: data.id.present ? data.id.value : this.id,
      ngoId: data.ngoId.present ? data.ngoId.value : this.ngoId,
      fullName: data.fullName.present ? data.fullName.value : this.fullName,
      householdSize: data.householdSize.present
          ? data.householdSize.value
          : this.householdSize,
      locationId: data.locationId.present
          ? data.locationId.value
          : this.locationId,
      contactMasked: data.contactMasked.present
          ? data.contactMasked.value
          : this.contactMasked,
      verified: data.verified.present ? data.verified.value : this.verified,
      verifiedBy: data.verifiedBy.present
          ? data.verifiedBy.value
          : this.verifiedBy,
      registeredBy: data.registeredBy.present
          ? data.registeredBy.value
          : this.registeredBy,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedBeneficiary(')
          ..write('id: $id, ')
          ..write('ngoId: $ngoId, ')
          ..write('fullName: $fullName, ')
          ..write('householdSize: $householdSize, ')
          ..write('locationId: $locationId, ')
          ..write('contactMasked: $contactMasked, ')
          ..write('verified: $verified, ')
          ..write('verifiedBy: $verifiedBy, ')
          ..write('registeredBy: $registeredBy, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    ngoId,
    fullName,
    householdSize,
    locationId,
    contactMasked,
    verified,
    verifiedBy,
    registeredBy,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedBeneficiary &&
          other.id == this.id &&
          other.ngoId == this.ngoId &&
          other.fullName == this.fullName &&
          other.householdSize == this.householdSize &&
          other.locationId == this.locationId &&
          other.contactMasked == this.contactMasked &&
          other.verified == this.verified &&
          other.verifiedBy == this.verifiedBy &&
          other.registeredBy == this.registeredBy &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class CachedBeneficiariesCompanion extends UpdateCompanion<CachedBeneficiary> {
  final Value<String> id;
  final Value<String> ngoId;
  final Value<String> fullName;
  final Value<int?> householdSize;
  final Value<String?> locationId;
  final Value<String?> contactMasked;
  final Value<bool> verified;
  final Value<String?> verifiedBy;
  final Value<String> registeredBy;
  final Value<String> createdAt;
  final Value<String> updatedAt;
  final Value<int> rowid;
  const CachedBeneficiariesCompanion({
    this.id = const Value.absent(),
    this.ngoId = const Value.absent(),
    this.fullName = const Value.absent(),
    this.householdSize = const Value.absent(),
    this.locationId = const Value.absent(),
    this.contactMasked = const Value.absent(),
    this.verified = const Value.absent(),
    this.verifiedBy = const Value.absent(),
    this.registeredBy = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedBeneficiariesCompanion.insert({
    required String id,
    required String ngoId,
    required String fullName,
    this.householdSize = const Value.absent(),
    this.locationId = const Value.absent(),
    this.contactMasked = const Value.absent(),
    required bool verified,
    this.verifiedBy = const Value.absent(),
    required String registeredBy,
    required String createdAt,
    required String updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       ngoId = Value(ngoId),
       fullName = Value(fullName),
       verified = Value(verified),
       registeredBy = Value(registeredBy),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<CachedBeneficiary> custom({
    Expression<String>? id,
    Expression<String>? ngoId,
    Expression<String>? fullName,
    Expression<int>? householdSize,
    Expression<String>? locationId,
    Expression<String>? contactMasked,
    Expression<bool>? verified,
    Expression<String>? verifiedBy,
    Expression<String>? registeredBy,
    Expression<String>? createdAt,
    Expression<String>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ngoId != null) 'ngo_id': ngoId,
      if (fullName != null) 'full_name': fullName,
      if (householdSize != null) 'household_size': householdSize,
      if (locationId != null) 'location_id': locationId,
      if (contactMasked != null) 'contact_masked': contactMasked,
      if (verified != null) 'verified': verified,
      if (verifiedBy != null) 'verified_by': verifiedBy,
      if (registeredBy != null) 'registered_by': registeredBy,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedBeneficiariesCompanion copyWith({
    Value<String>? id,
    Value<String>? ngoId,
    Value<String>? fullName,
    Value<int?>? householdSize,
    Value<String?>? locationId,
    Value<String?>? contactMasked,
    Value<bool>? verified,
    Value<String?>? verifiedBy,
    Value<String>? registeredBy,
    Value<String>? createdAt,
    Value<String>? updatedAt,
    Value<int>? rowid,
  }) {
    return CachedBeneficiariesCompanion(
      id: id ?? this.id,
      ngoId: ngoId ?? this.ngoId,
      fullName: fullName ?? this.fullName,
      householdSize: householdSize ?? this.householdSize,
      locationId: locationId ?? this.locationId,
      contactMasked: contactMasked ?? this.contactMasked,
      verified: verified ?? this.verified,
      verifiedBy: verifiedBy ?? this.verifiedBy,
      registeredBy: registeredBy ?? this.registeredBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ngoId.present) {
      map['ngo_id'] = Variable<String>(ngoId.value);
    }
    if (fullName.present) {
      map['full_name'] = Variable<String>(fullName.value);
    }
    if (householdSize.present) {
      map['household_size'] = Variable<int>(householdSize.value);
    }
    if (locationId.present) {
      map['location_id'] = Variable<String>(locationId.value);
    }
    if (contactMasked.present) {
      map['contact_masked'] = Variable<String>(contactMasked.value);
    }
    if (verified.present) {
      map['verified'] = Variable<bool>(verified.value);
    }
    if (verifiedBy.present) {
      map['verified_by'] = Variable<String>(verifiedBy.value);
    }
    if (registeredBy.present) {
      map['registered_by'] = Variable<String>(registeredBy.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<String>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedBeneficiariesCompanion(')
          ..write('id: $id, ')
          ..write('ngoId: $ngoId, ')
          ..write('fullName: $fullName, ')
          ..write('householdSize: $householdSize, ')
          ..write('locationId: $locationId, ')
          ..write('contactMasked: $contactMasked, ')
          ..write('verified: $verified, ')
          ..write('verifiedBy: $verifiedBy, ')
          ..write('registeredBy: $registeredBy, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedTasksTable extends CachedTasks
    with TableInfo<$CachedTasksTable, CachedTask> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedTasksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ngoIdMeta = const VerificationMeta('ngoId');
  @override
  late final GeneratedColumn<String> ngoId = GeneratedColumn<String>(
    'ngo_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _campaignIdMeta = const VerificationMeta(
    'campaignId',
  );
  @override
  late final GeneratedColumn<String> campaignId = GeneratedColumn<String>(
    'campaign_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationIdMeta = const VerificationMeta(
    'locationId',
  );
  @override
  late final GeneratedColumn<String> locationId = GeneratedColumn<String>(
    'location_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _rejectionCountMeta = const VerificationMeta(
    'rejectionCount',
  );
  @override
  late final GeneratedColumn<int> rejectionCount = GeneratedColumn<int>(
    'rejection_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _assignedToMeta = const VerificationMeta(
    'assignedTo',
  );
  @override
  late final GeneratedColumn<String> assignedTo = GeneratedColumn<String>(
    'assigned_to',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdByMeta = const VerificationMeta(
    'createdBy',
  );
  @override
  late final GeneratedColumn<String> createdBy = GeneratedColumn<String>(
    'created_by',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<String> createdAt = GeneratedColumn<String>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    ngoId,
    campaignId,
    title,
    description,
    locationId,
    status,
    rejectionCount,
    assignedTo,
    createdBy,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_tasks';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedTask> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('ngo_id')) {
      context.handle(
        _ngoIdMeta,
        ngoId.isAcceptableOrUnknown(data['ngo_id']!, _ngoIdMeta),
      );
    } else if (isInserting) {
      context.missing(_ngoIdMeta);
    }
    if (data.containsKey('campaign_id')) {
      context.handle(
        _campaignIdMeta,
        campaignId.isAcceptableOrUnknown(data['campaign_id']!, _campaignIdMeta),
      );
    } else if (isInserting) {
      context.missing(_campaignIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    }
    if (data.containsKey('location_id')) {
      context.handle(
        _locationIdMeta,
        locationId.isAcceptableOrUnknown(data['location_id']!, _locationIdMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('rejection_count')) {
      context.handle(
        _rejectionCountMeta,
        rejectionCount.isAcceptableOrUnknown(
          data['rejection_count']!,
          _rejectionCountMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_rejectionCountMeta);
    }
    if (data.containsKey('assigned_to')) {
      context.handle(
        _assignedToMeta,
        assignedTo.isAcceptableOrUnknown(data['assigned_to']!, _assignedToMeta),
      );
    }
    if (data.containsKey('created_by')) {
      context.handle(
        _createdByMeta,
        createdBy.isAcceptableOrUnknown(data['created_by']!, _createdByMeta),
      );
    } else if (isInserting) {
      context.missing(_createdByMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedTask map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedTask(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      ngoId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ngo_id'],
      )!,
      campaignId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}campaign_id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      ),
      locationId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location_id'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      rejectionCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}rejection_count'],
      )!,
      assignedTo: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}assigned_to'],
      ),
      createdBy: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_by'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $CachedTasksTable createAlias(String alias) {
    return $CachedTasksTable(attachedDatabase, alias);
  }
}

class CachedTask extends DataClass implements Insertable<CachedTask> {
  final String id;
  final String ngoId;
  final String campaignId;
  final String title;
  final String? description;
  final String? locationId;
  final String status;
  final int rejectionCount;
  final String? assignedTo;
  final String createdBy;
  final String createdAt;
  final String updatedAt;
  const CachedTask({
    required this.id,
    required this.ngoId,
    required this.campaignId,
    required this.title,
    this.description,
    this.locationId,
    required this.status,
    required this.rejectionCount,
    this.assignedTo,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['ngo_id'] = Variable<String>(ngoId);
    map['campaign_id'] = Variable<String>(campaignId);
    map['title'] = Variable<String>(title);
    if (!nullToAbsent || description != null) {
      map['description'] = Variable<String>(description);
    }
    if (!nullToAbsent || locationId != null) {
      map['location_id'] = Variable<String>(locationId);
    }
    map['status'] = Variable<String>(status);
    map['rejection_count'] = Variable<int>(rejectionCount);
    if (!nullToAbsent || assignedTo != null) {
      map['assigned_to'] = Variable<String>(assignedTo);
    }
    map['created_by'] = Variable<String>(createdBy);
    map['created_at'] = Variable<String>(createdAt);
    map['updated_at'] = Variable<String>(updatedAt);
    return map;
  }

  CachedTasksCompanion toCompanion(bool nullToAbsent) {
    return CachedTasksCompanion(
      id: Value(id),
      ngoId: Value(ngoId),
      campaignId: Value(campaignId),
      title: Value(title),
      description: description == null && nullToAbsent
          ? const Value.absent()
          : Value(description),
      locationId: locationId == null && nullToAbsent
          ? const Value.absent()
          : Value(locationId),
      status: Value(status),
      rejectionCount: Value(rejectionCount),
      assignedTo: assignedTo == null && nullToAbsent
          ? const Value.absent()
          : Value(assignedTo),
      createdBy: Value(createdBy),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory CachedTask.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedTask(
      id: serializer.fromJson<String>(json['id']),
      ngoId: serializer.fromJson<String>(json['ngoId']),
      campaignId: serializer.fromJson<String>(json['campaignId']),
      title: serializer.fromJson<String>(json['title']),
      description: serializer.fromJson<String?>(json['description']),
      locationId: serializer.fromJson<String?>(json['locationId']),
      status: serializer.fromJson<String>(json['status']),
      rejectionCount: serializer.fromJson<int>(json['rejectionCount']),
      assignedTo: serializer.fromJson<String?>(json['assignedTo']),
      createdBy: serializer.fromJson<String>(json['createdBy']),
      createdAt: serializer.fromJson<String>(json['createdAt']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ngoId': serializer.toJson<String>(ngoId),
      'campaignId': serializer.toJson<String>(campaignId),
      'title': serializer.toJson<String>(title),
      'description': serializer.toJson<String?>(description),
      'locationId': serializer.toJson<String?>(locationId),
      'status': serializer.toJson<String>(status),
      'rejectionCount': serializer.toJson<int>(rejectionCount),
      'assignedTo': serializer.toJson<String?>(assignedTo),
      'createdBy': serializer.toJson<String>(createdBy),
      'createdAt': serializer.toJson<String>(createdAt),
      'updatedAt': serializer.toJson<String>(updatedAt),
    };
  }

  CachedTask copyWith({
    String? id,
    String? ngoId,
    String? campaignId,
    String? title,
    Value<String?> description = const Value.absent(),
    Value<String?> locationId = const Value.absent(),
    String? status,
    int? rejectionCount,
    Value<String?> assignedTo = const Value.absent(),
    String? createdBy,
    String? createdAt,
    String? updatedAt,
  }) => CachedTask(
    id: id ?? this.id,
    ngoId: ngoId ?? this.ngoId,
    campaignId: campaignId ?? this.campaignId,
    title: title ?? this.title,
    description: description.present ? description.value : this.description,
    locationId: locationId.present ? locationId.value : this.locationId,
    status: status ?? this.status,
    rejectionCount: rejectionCount ?? this.rejectionCount,
    assignedTo: assignedTo.present ? assignedTo.value : this.assignedTo,
    createdBy: createdBy ?? this.createdBy,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  CachedTask copyWithCompanion(CachedTasksCompanion data) {
    return CachedTask(
      id: data.id.present ? data.id.value : this.id,
      ngoId: data.ngoId.present ? data.ngoId.value : this.ngoId,
      campaignId: data.campaignId.present
          ? data.campaignId.value
          : this.campaignId,
      title: data.title.present ? data.title.value : this.title,
      description: data.description.present
          ? data.description.value
          : this.description,
      locationId: data.locationId.present
          ? data.locationId.value
          : this.locationId,
      status: data.status.present ? data.status.value : this.status,
      rejectionCount: data.rejectionCount.present
          ? data.rejectionCount.value
          : this.rejectionCount,
      assignedTo: data.assignedTo.present
          ? data.assignedTo.value
          : this.assignedTo,
      createdBy: data.createdBy.present ? data.createdBy.value : this.createdBy,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedTask(')
          ..write('id: $id, ')
          ..write('ngoId: $ngoId, ')
          ..write('campaignId: $campaignId, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('locationId: $locationId, ')
          ..write('status: $status, ')
          ..write('rejectionCount: $rejectionCount, ')
          ..write('assignedTo: $assignedTo, ')
          ..write('createdBy: $createdBy, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    ngoId,
    campaignId,
    title,
    description,
    locationId,
    status,
    rejectionCount,
    assignedTo,
    createdBy,
    createdAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedTask &&
          other.id == this.id &&
          other.ngoId == this.ngoId &&
          other.campaignId == this.campaignId &&
          other.title == this.title &&
          other.description == this.description &&
          other.locationId == this.locationId &&
          other.status == this.status &&
          other.rejectionCount == this.rejectionCount &&
          other.assignedTo == this.assignedTo &&
          other.createdBy == this.createdBy &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class CachedTasksCompanion extends UpdateCompanion<CachedTask> {
  final Value<String> id;
  final Value<String> ngoId;
  final Value<String> campaignId;
  final Value<String> title;
  final Value<String?> description;
  final Value<String?> locationId;
  final Value<String> status;
  final Value<int> rejectionCount;
  final Value<String?> assignedTo;
  final Value<String> createdBy;
  final Value<String> createdAt;
  final Value<String> updatedAt;
  final Value<int> rowid;
  const CachedTasksCompanion({
    this.id = const Value.absent(),
    this.ngoId = const Value.absent(),
    this.campaignId = const Value.absent(),
    this.title = const Value.absent(),
    this.description = const Value.absent(),
    this.locationId = const Value.absent(),
    this.status = const Value.absent(),
    this.rejectionCount = const Value.absent(),
    this.assignedTo = const Value.absent(),
    this.createdBy = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedTasksCompanion.insert({
    required String id,
    required String ngoId,
    required String campaignId,
    required String title,
    this.description = const Value.absent(),
    this.locationId = const Value.absent(),
    required String status,
    required int rejectionCount,
    this.assignedTo = const Value.absent(),
    required String createdBy,
    required String createdAt,
    required String updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       ngoId = Value(ngoId),
       campaignId = Value(campaignId),
       title = Value(title),
       status = Value(status),
       rejectionCount = Value(rejectionCount),
       createdBy = Value(createdBy),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<CachedTask> custom({
    Expression<String>? id,
    Expression<String>? ngoId,
    Expression<String>? campaignId,
    Expression<String>? title,
    Expression<String>? description,
    Expression<String>? locationId,
    Expression<String>? status,
    Expression<int>? rejectionCount,
    Expression<String>? assignedTo,
    Expression<String>? createdBy,
    Expression<String>? createdAt,
    Expression<String>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ngoId != null) 'ngo_id': ngoId,
      if (campaignId != null) 'campaign_id': campaignId,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (locationId != null) 'location_id': locationId,
      if (status != null) 'status': status,
      if (rejectionCount != null) 'rejection_count': rejectionCount,
      if (assignedTo != null) 'assigned_to': assignedTo,
      if (createdBy != null) 'created_by': createdBy,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedTasksCompanion copyWith({
    Value<String>? id,
    Value<String>? ngoId,
    Value<String>? campaignId,
    Value<String>? title,
    Value<String?>? description,
    Value<String?>? locationId,
    Value<String>? status,
    Value<int>? rejectionCount,
    Value<String?>? assignedTo,
    Value<String>? createdBy,
    Value<String>? createdAt,
    Value<String>? updatedAt,
    Value<int>? rowid,
  }) {
    return CachedTasksCompanion(
      id: id ?? this.id,
      ngoId: ngoId ?? this.ngoId,
      campaignId: campaignId ?? this.campaignId,
      title: title ?? this.title,
      description: description ?? this.description,
      locationId: locationId ?? this.locationId,
      status: status ?? this.status,
      rejectionCount: rejectionCount ?? this.rejectionCount,
      assignedTo: assignedTo ?? this.assignedTo,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ngoId.present) {
      map['ngo_id'] = Variable<String>(ngoId.value);
    }
    if (campaignId.present) {
      map['campaign_id'] = Variable<String>(campaignId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (locationId.present) {
      map['location_id'] = Variable<String>(locationId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (rejectionCount.present) {
      map['rejection_count'] = Variable<int>(rejectionCount.value);
    }
    if (assignedTo.present) {
      map['assigned_to'] = Variable<String>(assignedTo.value);
    }
    if (createdBy.present) {
      map['created_by'] = Variable<String>(createdBy.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<String>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedTasksCompanion(')
          ..write('id: $id, ')
          ..write('ngoId: $ngoId, ')
          ..write('campaignId: $campaignId, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('locationId: $locationId, ')
          ..write('status: $status, ')
          ..write('rejectionCount: $rejectionCount, ')
          ..write('assignedTo: $assignedTo, ')
          ..write('createdBy: $createdBy, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedCampaignsTable extends CachedCampaigns
    with TableInfo<$CachedCampaignsTable, CachedCampaign> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedCampaignsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, name, status];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_campaigns';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedCampaign> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedCampaign map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedCampaign(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
    );
  }

  @override
  $CachedCampaignsTable createAlias(String alias) {
    return $CachedCampaignsTable(attachedDatabase, alias);
  }
}

class CachedCampaign extends DataClass implements Insertable<CachedCampaign> {
  final String id;
  final String name;
  final String status;
  const CachedCampaign({
    required this.id,
    required this.name,
    required this.status,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    map['status'] = Variable<String>(status);
    return map;
  }

  CachedCampaignsCompanion toCompanion(bool nullToAbsent) {
    return CachedCampaignsCompanion(
      id: Value(id),
      name: Value(name),
      status: Value(status),
    );
  }

  factory CachedCampaign.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedCampaign(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      status: serializer.fromJson<String>(json['status']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'status': serializer.toJson<String>(status),
    };
  }

  CachedCampaign copyWith({String? id, String? name, String? status}) =>
      CachedCampaign(
        id: id ?? this.id,
        name: name ?? this.name,
        status: status ?? this.status,
      );
  CachedCampaign copyWithCompanion(CachedCampaignsCompanion data) {
    return CachedCampaign(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      status: data.status.present ? data.status.value : this.status,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedCampaign(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('status: $status')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, status);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedCampaign &&
          other.id == this.id &&
          other.name == this.name &&
          other.status == this.status);
}

class CachedCampaignsCompanion extends UpdateCompanion<CachedCampaign> {
  final Value<String> id;
  final Value<String> name;
  final Value<String> status;
  final Value<int> rowid;
  const CachedCampaignsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.status = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedCampaignsCompanion.insert({
    required String id,
    required String name,
    required String status,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       name = Value(name),
       status = Value(status);
  static Insertable<CachedCampaign> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? status,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (status != null) 'status': status,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedCampaignsCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<String>? status,
    Value<int>? rowid,
  }) {
    return CachedCampaignsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      status: status ?? this.status,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedCampaignsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncMetaTable extends SyncMeta
    with TableInfo<$SyncMetaTable, SyncMetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncMetaData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  SyncMetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncMetaData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $SyncMetaTable createAlias(String alias) {
    return $SyncMetaTable(attachedDatabase, alias);
  }
}

class SyncMetaData extends DataClass implements Insertable<SyncMetaData> {
  final String key;
  final String value;
  const SyncMetaData({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  SyncMetaCompanion toCompanion(bool nullToAbsent) {
    return SyncMetaCompanion(key: Value(key), value: Value(value));
  }

  factory SyncMetaData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncMetaData(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  SyncMetaData copyWith({String? key, String? value}) =>
      SyncMetaData(key: key ?? this.key, value: value ?? this.value);
  SyncMetaData copyWithCompanion(SyncMetaCompanion data) {
    return SyncMetaData(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncMetaData(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncMetaData &&
          other.key == this.key &&
          other.value == this.value);
}

class SyncMetaCompanion extends UpdateCompanion<SyncMetaData> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const SyncMetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncMetaCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       value = Value(value);
  static Insertable<SyncMetaData> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncMetaCompanion copyWith({
    Value<String>? key,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return SyncMetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncMetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OutboxTable extends Outbox with TableInfo<$OutboxTable, OutboxData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _clientUuidMeta = const VerificationMeta(
    'clientUuid',
  );
  @override
  late final GeneratedColumn<String> clientUuid = GeneratedColumn<String>(
    'client_uuid',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _entityTypeMeta = const VerificationMeta(
    'entityType',
  );
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
    'entity_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityIdMeta = const VerificationMeta(
    'entityId',
  );
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
    'entity_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _baseStatusMeta = const VerificationMeta(
    'baseStatus',
  );
  @override
  late final GeneratedColumn<String> baseStatus = GeneratedColumn<String>(
    'base_status',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _baseVerifiedMeta = const VerificationMeta(
    'baseVerified',
  );
  @override
  late final GeneratedColumn<bool> baseVerified = GeneratedColumn<bool>(
    'base_verified',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("base_verified" IN (0, 1))',
    ),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _clientCreatedAtMeta = const VerificationMeta(
    'clientCreatedAt',
  );
  @override
  late final GeneratedColumn<String> clientCreatedAt = GeneratedColumn<String>(
    'client_created_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    clientUuid,
    entityType,
    entityId,
    payload,
    baseStatus,
    baseVerified,
    status,
    clientCreatedAt,
    attempts,
    lastError,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('client_uuid')) {
      context.handle(
        _clientUuidMeta,
        clientUuid.isAcceptableOrUnknown(data['client_uuid']!, _clientUuidMeta),
      );
    } else if (isInserting) {
      context.missing(_clientUuidMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
        _entityTypeMeta,
        entityType.isAcceptableOrUnknown(data['entity_type']!, _entityTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(
        _entityIdMeta,
        entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta),
      );
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('base_status')) {
      context.handle(
        _baseStatusMeta,
        baseStatus.isAcceptableOrUnknown(data['base_status']!, _baseStatusMeta),
      );
    }
    if (data.containsKey('base_verified')) {
      context.handle(
        _baseVerifiedMeta,
        baseVerified.isAcceptableOrUnknown(
          data['base_verified']!,
          _baseVerifiedMeta,
        ),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('client_created_at')) {
      context.handle(
        _clientCreatedAtMeta,
        clientCreatedAt.isAcceptableOrUnknown(
          data['client_created_at']!,
          _clientCreatedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientCreatedAtMeta);
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OutboxData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      clientUuid: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_uuid'],
      )!,
      entityType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_type'],
      )!,
      entityId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_id'],
      ),
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      baseStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}base_status'],
      ),
      baseVerified: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}base_verified'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      clientCreatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_created_at'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
    );
  }

  @override
  $OutboxTable createAlias(String alias) {
    return $OutboxTable(attachedDatabase, alias);
  }
}

class OutboxData extends DataClass implements Insertable<OutboxData> {
  final int id;
  final String clientUuid;
  final String entityType;
  final String? entityId;
  final String payload;
  final String? baseStatus;
  final bool? baseVerified;
  final String status;
  final String clientCreatedAt;
  final int attempts;
  final String? lastError;
  const OutboxData({
    required this.id,
    required this.clientUuid,
    required this.entityType,
    this.entityId,
    required this.payload,
    this.baseStatus,
    this.baseVerified,
    required this.status,
    required this.clientCreatedAt,
    required this.attempts,
    this.lastError,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['client_uuid'] = Variable<String>(clientUuid);
    map['entity_type'] = Variable<String>(entityType);
    if (!nullToAbsent || entityId != null) {
      map['entity_id'] = Variable<String>(entityId);
    }
    map['payload'] = Variable<String>(payload);
    if (!nullToAbsent || baseStatus != null) {
      map['base_status'] = Variable<String>(baseStatus);
    }
    if (!nullToAbsent || baseVerified != null) {
      map['base_verified'] = Variable<bool>(baseVerified);
    }
    map['status'] = Variable<String>(status);
    map['client_created_at'] = Variable<String>(clientCreatedAt);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    return map;
  }

  OutboxCompanion toCompanion(bool nullToAbsent) {
    return OutboxCompanion(
      id: Value(id),
      clientUuid: Value(clientUuid),
      entityType: Value(entityType),
      entityId: entityId == null && nullToAbsent
          ? const Value.absent()
          : Value(entityId),
      payload: Value(payload),
      baseStatus: baseStatus == null && nullToAbsent
          ? const Value.absent()
          : Value(baseStatus),
      baseVerified: baseVerified == null && nullToAbsent
          ? const Value.absent()
          : Value(baseVerified),
      status: Value(status),
      clientCreatedAt: Value(clientCreatedAt),
      attempts: Value(attempts),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
    );
  }

  factory OutboxData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxData(
      id: serializer.fromJson<int>(json['id']),
      clientUuid: serializer.fromJson<String>(json['clientUuid']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String?>(json['entityId']),
      payload: serializer.fromJson<String>(json['payload']),
      baseStatus: serializer.fromJson<String?>(json['baseStatus']),
      baseVerified: serializer.fromJson<bool?>(json['baseVerified']),
      status: serializer.fromJson<String>(json['status']),
      clientCreatedAt: serializer.fromJson<String>(json['clientCreatedAt']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastError: serializer.fromJson<String?>(json['lastError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'clientUuid': serializer.toJson<String>(clientUuid),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String?>(entityId),
      'payload': serializer.toJson<String>(payload),
      'baseStatus': serializer.toJson<String?>(baseStatus),
      'baseVerified': serializer.toJson<bool?>(baseVerified),
      'status': serializer.toJson<String>(status),
      'clientCreatedAt': serializer.toJson<String>(clientCreatedAt),
      'attempts': serializer.toJson<int>(attempts),
      'lastError': serializer.toJson<String?>(lastError),
    };
  }

  OutboxData copyWith({
    int? id,
    String? clientUuid,
    String? entityType,
    Value<String?> entityId = const Value.absent(),
    String? payload,
    Value<String?> baseStatus = const Value.absent(),
    Value<bool?> baseVerified = const Value.absent(),
    String? status,
    String? clientCreatedAt,
    int? attempts,
    Value<String?> lastError = const Value.absent(),
  }) => OutboxData(
    id: id ?? this.id,
    clientUuid: clientUuid ?? this.clientUuid,
    entityType: entityType ?? this.entityType,
    entityId: entityId.present ? entityId.value : this.entityId,
    payload: payload ?? this.payload,
    baseStatus: baseStatus.present ? baseStatus.value : this.baseStatus,
    baseVerified: baseVerified.present ? baseVerified.value : this.baseVerified,
    status: status ?? this.status,
    clientCreatedAt: clientCreatedAt ?? this.clientCreatedAt,
    attempts: attempts ?? this.attempts,
    lastError: lastError.present ? lastError.value : this.lastError,
  );
  OutboxData copyWithCompanion(OutboxCompanion data) {
    return OutboxData(
      id: data.id.present ? data.id.value : this.id,
      clientUuid: data.clientUuid.present
          ? data.clientUuid.value
          : this.clientUuid,
      entityType: data.entityType.present
          ? data.entityType.value
          : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      payload: data.payload.present ? data.payload.value : this.payload,
      baseStatus: data.baseStatus.present
          ? data.baseStatus.value
          : this.baseStatus,
      baseVerified: data.baseVerified.present
          ? data.baseVerified.value
          : this.baseVerified,
      status: data.status.present ? data.status.value : this.status,
      clientCreatedAt: data.clientCreatedAt.present
          ? data.clientCreatedAt.value
          : this.clientCreatedAt,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxData(')
          ..write('id: $id, ')
          ..write('clientUuid: $clientUuid, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('payload: $payload, ')
          ..write('baseStatus: $baseStatus, ')
          ..write('baseVerified: $baseVerified, ')
          ..write('status: $status, ')
          ..write('clientCreatedAt: $clientCreatedAt, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    clientUuid,
    entityType,
    entityId,
    payload,
    baseStatus,
    baseVerified,
    status,
    clientCreatedAt,
    attempts,
    lastError,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxData &&
          other.id == this.id &&
          other.clientUuid == this.clientUuid &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.payload == this.payload &&
          other.baseStatus == this.baseStatus &&
          other.baseVerified == this.baseVerified &&
          other.status == this.status &&
          other.clientCreatedAt == this.clientCreatedAt &&
          other.attempts == this.attempts &&
          other.lastError == this.lastError);
}

class OutboxCompanion extends UpdateCompanion<OutboxData> {
  final Value<int> id;
  final Value<String> clientUuid;
  final Value<String> entityType;
  final Value<String?> entityId;
  final Value<String> payload;
  final Value<String?> baseStatus;
  final Value<bool?> baseVerified;
  final Value<String> status;
  final Value<String> clientCreatedAt;
  final Value<int> attempts;
  final Value<String?> lastError;
  const OutboxCompanion({
    this.id = const Value.absent(),
    this.clientUuid = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.payload = const Value.absent(),
    this.baseStatus = const Value.absent(),
    this.baseVerified = const Value.absent(),
    this.status = const Value.absent(),
    this.clientCreatedAt = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
  });
  OutboxCompanion.insert({
    this.id = const Value.absent(),
    required String clientUuid,
    required String entityType,
    this.entityId = const Value.absent(),
    required String payload,
    this.baseStatus = const Value.absent(),
    this.baseVerified = const Value.absent(),
    this.status = const Value.absent(),
    required String clientCreatedAt,
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
  }) : clientUuid = Value(clientUuid),
       entityType = Value(entityType),
       payload = Value(payload),
       clientCreatedAt = Value(clientCreatedAt);
  static Insertable<OutboxData> custom({
    Expression<int>? id,
    Expression<String>? clientUuid,
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<String>? payload,
    Expression<String>? baseStatus,
    Expression<bool>? baseVerified,
    Expression<String>? status,
    Expression<String>? clientCreatedAt,
    Expression<int>? attempts,
    Expression<String>? lastError,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (clientUuid != null) 'client_uuid': clientUuid,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (payload != null) 'payload': payload,
      if (baseStatus != null) 'base_status': baseStatus,
      if (baseVerified != null) 'base_verified': baseVerified,
      if (status != null) 'status': status,
      if (clientCreatedAt != null) 'client_created_at': clientCreatedAt,
      if (attempts != null) 'attempts': attempts,
      if (lastError != null) 'last_error': lastError,
    });
  }

  OutboxCompanion copyWith({
    Value<int>? id,
    Value<String>? clientUuid,
    Value<String>? entityType,
    Value<String?>? entityId,
    Value<String>? payload,
    Value<String?>? baseStatus,
    Value<bool?>? baseVerified,
    Value<String>? status,
    Value<String>? clientCreatedAt,
    Value<int>? attempts,
    Value<String?>? lastError,
  }) {
    return OutboxCompanion(
      id: id ?? this.id,
      clientUuid: clientUuid ?? this.clientUuid,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      payload: payload ?? this.payload,
      baseStatus: baseStatus ?? this.baseStatus,
      baseVerified: baseVerified ?? this.baseVerified,
      status: status ?? this.status,
      clientCreatedAt: clientCreatedAt ?? this.clientCreatedAt,
      attempts: attempts ?? this.attempts,
      lastError: lastError ?? this.lastError,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (clientUuid.present) {
      map['client_uuid'] = Variable<String>(clientUuid.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (baseStatus.present) {
      map['base_status'] = Variable<String>(baseStatus.value);
    }
    if (baseVerified.present) {
      map['base_verified'] = Variable<bool>(baseVerified.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (clientCreatedAt.present) {
      map['client_created_at'] = Variable<String>(clientCreatedAt.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxCompanion(')
          ..write('id: $id, ')
          ..write('clientUuid: $clientUuid, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('payload: $payload, ')
          ..write('baseStatus: $baseStatus, ')
          ..write('baseVerified: $baseVerified, ')
          ..write('status: $status, ')
          ..write('clientCreatedAt: $clientCreatedAt, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $CachedBeneficiariesTable cachedBeneficiaries =
      $CachedBeneficiariesTable(this);
  late final $CachedTasksTable cachedTasks = $CachedTasksTable(this);
  late final $CachedCampaignsTable cachedCampaigns = $CachedCampaignsTable(
    this,
  );
  late final $SyncMetaTable syncMeta = $SyncMetaTable(this);
  late final $OutboxTable outbox = $OutboxTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    cachedBeneficiaries,
    cachedTasks,
    cachedCampaigns,
    syncMeta,
    outbox,
  ];
}

typedef $$CachedBeneficiariesTableCreateCompanionBuilder =
    CachedBeneficiariesCompanion Function({
      required String id,
      required String ngoId,
      required String fullName,
      Value<int?> householdSize,
      Value<String?> locationId,
      Value<String?> contactMasked,
      required bool verified,
      Value<String?> verifiedBy,
      required String registeredBy,
      required String createdAt,
      required String updatedAt,
      Value<int> rowid,
    });
typedef $$CachedBeneficiariesTableUpdateCompanionBuilder =
    CachedBeneficiariesCompanion Function({
      Value<String> id,
      Value<String> ngoId,
      Value<String> fullName,
      Value<int?> householdSize,
      Value<String?> locationId,
      Value<String?> contactMasked,
      Value<bool> verified,
      Value<String?> verifiedBy,
      Value<String> registeredBy,
      Value<String> createdAt,
      Value<String> updatedAt,
      Value<int> rowid,
    });

class $$CachedBeneficiariesTableFilterComposer
    extends Composer<_$AppDatabase, $CachedBeneficiariesTable> {
  $$CachedBeneficiariesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ngoId => $composableBuilder(
    column: $table.ngoId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get householdSize => $composableBuilder(
    column: $table.householdSize,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locationId => $composableBuilder(
    column: $table.locationId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get contactMasked => $composableBuilder(
    column: $table.contactMasked,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get verified => $composableBuilder(
    column: $table.verified,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get verifiedBy => $composableBuilder(
    column: $table.verifiedBy,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get registeredBy => $composableBuilder(
    column: $table.registeredBy,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedBeneficiariesTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedBeneficiariesTable> {
  $$CachedBeneficiariesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ngoId => $composableBuilder(
    column: $table.ngoId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fullName => $composableBuilder(
    column: $table.fullName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get householdSize => $composableBuilder(
    column: $table.householdSize,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locationId => $composableBuilder(
    column: $table.locationId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get contactMasked => $composableBuilder(
    column: $table.contactMasked,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get verified => $composableBuilder(
    column: $table.verified,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get verifiedBy => $composableBuilder(
    column: $table.verifiedBy,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get registeredBy => $composableBuilder(
    column: $table.registeredBy,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedBeneficiariesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedBeneficiariesTable> {
  $$CachedBeneficiariesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ngoId =>
      $composableBuilder(column: $table.ngoId, builder: (column) => column);

  GeneratedColumn<String> get fullName =>
      $composableBuilder(column: $table.fullName, builder: (column) => column);

  GeneratedColumn<int> get householdSize => $composableBuilder(
    column: $table.householdSize,
    builder: (column) => column,
  );

  GeneratedColumn<String> get locationId => $composableBuilder(
    column: $table.locationId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get contactMasked => $composableBuilder(
    column: $table.contactMasked,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get verified =>
      $composableBuilder(column: $table.verified, builder: (column) => column);

  GeneratedColumn<String> get verifiedBy => $composableBuilder(
    column: $table.verifiedBy,
    builder: (column) => column,
  );

  GeneratedColumn<String> get registeredBy => $composableBuilder(
    column: $table.registeredBy,
    builder: (column) => column,
  );

  GeneratedColumn<String> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$CachedBeneficiariesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedBeneficiariesTable,
          CachedBeneficiary,
          $$CachedBeneficiariesTableFilterComposer,
          $$CachedBeneficiariesTableOrderingComposer,
          $$CachedBeneficiariesTableAnnotationComposer,
          $$CachedBeneficiariesTableCreateCompanionBuilder,
          $$CachedBeneficiariesTableUpdateCompanionBuilder,
          (
            CachedBeneficiary,
            BaseReferences<
              _$AppDatabase,
              $CachedBeneficiariesTable,
              CachedBeneficiary
            >,
          ),
          CachedBeneficiary,
          PrefetchHooks Function()
        > {
  $$CachedBeneficiariesTableTableManager(
    _$AppDatabase db,
    $CachedBeneficiariesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedBeneficiariesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedBeneficiariesTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$CachedBeneficiariesTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> ngoId = const Value.absent(),
                Value<String> fullName = const Value.absent(),
                Value<int?> householdSize = const Value.absent(),
                Value<String?> locationId = const Value.absent(),
                Value<String?> contactMasked = const Value.absent(),
                Value<bool> verified = const Value.absent(),
                Value<String?> verifiedBy = const Value.absent(),
                Value<String> registeredBy = const Value.absent(),
                Value<String> createdAt = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedBeneficiariesCompanion(
                id: id,
                ngoId: ngoId,
                fullName: fullName,
                householdSize: householdSize,
                locationId: locationId,
                contactMasked: contactMasked,
                verified: verified,
                verifiedBy: verifiedBy,
                registeredBy: registeredBy,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String ngoId,
                required String fullName,
                Value<int?> householdSize = const Value.absent(),
                Value<String?> locationId = const Value.absent(),
                Value<String?> contactMasked = const Value.absent(),
                required bool verified,
                Value<String?> verifiedBy = const Value.absent(),
                required String registeredBy,
                required String createdAt,
                required String updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedBeneficiariesCompanion.insert(
                id: id,
                ngoId: ngoId,
                fullName: fullName,
                householdSize: householdSize,
                locationId: locationId,
                contactMasked: contactMasked,
                verified: verified,
                verifiedBy: verifiedBy,
                registeredBy: registeredBy,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedBeneficiariesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedBeneficiariesTable,
      CachedBeneficiary,
      $$CachedBeneficiariesTableFilterComposer,
      $$CachedBeneficiariesTableOrderingComposer,
      $$CachedBeneficiariesTableAnnotationComposer,
      $$CachedBeneficiariesTableCreateCompanionBuilder,
      $$CachedBeneficiariesTableUpdateCompanionBuilder,
      (
        CachedBeneficiary,
        BaseReferences<
          _$AppDatabase,
          $CachedBeneficiariesTable,
          CachedBeneficiary
        >,
      ),
      CachedBeneficiary,
      PrefetchHooks Function()
    >;
typedef $$CachedTasksTableCreateCompanionBuilder =
    CachedTasksCompanion Function({
      required String id,
      required String ngoId,
      required String campaignId,
      required String title,
      Value<String?> description,
      Value<String?> locationId,
      required String status,
      required int rejectionCount,
      Value<String?> assignedTo,
      required String createdBy,
      required String createdAt,
      required String updatedAt,
      Value<int> rowid,
    });
typedef $$CachedTasksTableUpdateCompanionBuilder =
    CachedTasksCompanion Function({
      Value<String> id,
      Value<String> ngoId,
      Value<String> campaignId,
      Value<String> title,
      Value<String?> description,
      Value<String?> locationId,
      Value<String> status,
      Value<int> rejectionCount,
      Value<String?> assignedTo,
      Value<String> createdBy,
      Value<String> createdAt,
      Value<String> updatedAt,
      Value<int> rowid,
    });

class $$CachedTasksTableFilterComposer
    extends Composer<_$AppDatabase, $CachedTasksTable> {
  $$CachedTasksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ngoId => $composableBuilder(
    column: $table.ngoId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get campaignId => $composableBuilder(
    column: $table.campaignId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locationId => $composableBuilder(
    column: $table.locationId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get rejectionCount => $composableBuilder(
    column: $table.rejectionCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get assignedTo => $composableBuilder(
    column: $table.assignedTo,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get createdBy => $composableBuilder(
    column: $table.createdBy,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedTasksTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedTasksTable> {
  $$CachedTasksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ngoId => $composableBuilder(
    column: $table.ngoId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get campaignId => $composableBuilder(
    column: $table.campaignId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locationId => $composableBuilder(
    column: $table.locationId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get rejectionCount => $composableBuilder(
    column: $table.rejectionCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get assignedTo => $composableBuilder(
    column: $table.assignedTo,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get createdBy => $composableBuilder(
    column: $table.createdBy,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedTasksTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedTasksTable> {
  $$CachedTasksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ngoId =>
      $composableBuilder(column: $table.ngoId, builder: (column) => column);

  GeneratedColumn<String> get campaignId => $composableBuilder(
    column: $table.campaignId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<String> get locationId => $composableBuilder(
    column: $table.locationId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get rejectionCount => $composableBuilder(
    column: $table.rejectionCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get assignedTo => $composableBuilder(
    column: $table.assignedTo,
    builder: (column) => column,
  );

  GeneratedColumn<String> get createdBy =>
      $composableBuilder(column: $table.createdBy, builder: (column) => column);

  GeneratedColumn<String> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$CachedTasksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedTasksTable,
          CachedTask,
          $$CachedTasksTableFilterComposer,
          $$CachedTasksTableOrderingComposer,
          $$CachedTasksTableAnnotationComposer,
          $$CachedTasksTableCreateCompanionBuilder,
          $$CachedTasksTableUpdateCompanionBuilder,
          (
            CachedTask,
            BaseReferences<_$AppDatabase, $CachedTasksTable, CachedTask>,
          ),
          CachedTask,
          PrefetchHooks Function()
        > {
  $$CachedTasksTableTableManager(_$AppDatabase db, $CachedTasksTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedTasksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedTasksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedTasksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> ngoId = const Value.absent(),
                Value<String> campaignId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String?> description = const Value.absent(),
                Value<String?> locationId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> rejectionCount = const Value.absent(),
                Value<String?> assignedTo = const Value.absent(),
                Value<String> createdBy = const Value.absent(),
                Value<String> createdAt = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedTasksCompanion(
                id: id,
                ngoId: ngoId,
                campaignId: campaignId,
                title: title,
                description: description,
                locationId: locationId,
                status: status,
                rejectionCount: rejectionCount,
                assignedTo: assignedTo,
                createdBy: createdBy,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String ngoId,
                required String campaignId,
                required String title,
                Value<String?> description = const Value.absent(),
                Value<String?> locationId = const Value.absent(),
                required String status,
                required int rejectionCount,
                Value<String?> assignedTo = const Value.absent(),
                required String createdBy,
                required String createdAt,
                required String updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => CachedTasksCompanion.insert(
                id: id,
                ngoId: ngoId,
                campaignId: campaignId,
                title: title,
                description: description,
                locationId: locationId,
                status: status,
                rejectionCount: rejectionCount,
                assignedTo: assignedTo,
                createdBy: createdBy,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedTasksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedTasksTable,
      CachedTask,
      $$CachedTasksTableFilterComposer,
      $$CachedTasksTableOrderingComposer,
      $$CachedTasksTableAnnotationComposer,
      $$CachedTasksTableCreateCompanionBuilder,
      $$CachedTasksTableUpdateCompanionBuilder,
      (
        CachedTask,
        BaseReferences<_$AppDatabase, $CachedTasksTable, CachedTask>,
      ),
      CachedTask,
      PrefetchHooks Function()
    >;
typedef $$CachedCampaignsTableCreateCompanionBuilder =
    CachedCampaignsCompanion Function({
      required String id,
      required String name,
      required String status,
      Value<int> rowid,
    });
typedef $$CachedCampaignsTableUpdateCompanionBuilder =
    CachedCampaignsCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<String> status,
      Value<int> rowid,
    });

class $$CachedCampaignsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedCampaignsTable> {
  $$CachedCampaignsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedCampaignsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedCampaignsTable> {
  $$CachedCampaignsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedCampaignsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedCampaignsTable> {
  $$CachedCampaignsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);
}

class $$CachedCampaignsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedCampaignsTable,
          CachedCampaign,
          $$CachedCampaignsTableFilterComposer,
          $$CachedCampaignsTableOrderingComposer,
          $$CachedCampaignsTableAnnotationComposer,
          $$CachedCampaignsTableCreateCompanionBuilder,
          $$CachedCampaignsTableUpdateCompanionBuilder,
          (
            CachedCampaign,
            BaseReferences<
              _$AppDatabase,
              $CachedCampaignsTable,
              CachedCampaign
            >,
          ),
          CachedCampaign,
          PrefetchHooks Function()
        > {
  $$CachedCampaignsTableTableManager(
    _$AppDatabase db,
    $CachedCampaignsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedCampaignsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedCampaignsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedCampaignsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedCampaignsCompanion(
                id: id,
                name: name,
                status: status,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String name,
                required String status,
                Value<int> rowid = const Value.absent(),
              }) => CachedCampaignsCompanion.insert(
                id: id,
                name: name,
                status: status,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedCampaignsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedCampaignsTable,
      CachedCampaign,
      $$CachedCampaignsTableFilterComposer,
      $$CachedCampaignsTableOrderingComposer,
      $$CachedCampaignsTableAnnotationComposer,
      $$CachedCampaignsTableCreateCompanionBuilder,
      $$CachedCampaignsTableUpdateCompanionBuilder,
      (
        CachedCampaign,
        BaseReferences<_$AppDatabase, $CachedCampaignsTable, CachedCampaign>,
      ),
      CachedCampaign,
      PrefetchHooks Function()
    >;
typedef $$SyncMetaTableCreateCompanionBuilder =
    SyncMetaCompanion Function({
      required String key,
      required String value,
      Value<int> rowid,
    });
typedef $$SyncMetaTableUpdateCompanionBuilder =
    SyncMetaCompanion Function({
      Value<String> key,
      Value<String> value,
      Value<int> rowid,
    });

class $$SyncMetaTableFilterComposer
    extends Composer<_$AppDatabase, $SyncMetaTable> {
  $$SyncMetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SyncMetaTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncMetaTable> {
  $$SyncMetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SyncMetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncMetaTable> {
  $$SyncMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$SyncMetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SyncMetaTable,
          SyncMetaData,
          $$SyncMetaTableFilterComposer,
          $$SyncMetaTableOrderingComposer,
          $$SyncMetaTableAnnotationComposer,
          $$SyncMetaTableCreateCompanionBuilder,
          $$SyncMetaTableUpdateCompanionBuilder,
          (
            SyncMetaData,
            BaseReferences<_$AppDatabase, $SyncMetaTable, SyncMetaData>,
          ),
          SyncMetaData,
          PrefetchHooks Function()
        > {
  $$SyncMetaTableTableManager(_$AppDatabase db, $SyncMetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncMetaCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String key,
                required String value,
                Value<int> rowid = const Value.absent(),
              }) => SyncMetaCompanion.insert(
                key: key,
                value: value,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SyncMetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SyncMetaTable,
      SyncMetaData,
      $$SyncMetaTableFilterComposer,
      $$SyncMetaTableOrderingComposer,
      $$SyncMetaTableAnnotationComposer,
      $$SyncMetaTableCreateCompanionBuilder,
      $$SyncMetaTableUpdateCompanionBuilder,
      (
        SyncMetaData,
        BaseReferences<_$AppDatabase, $SyncMetaTable, SyncMetaData>,
      ),
      SyncMetaData,
      PrefetchHooks Function()
    >;
typedef $$OutboxTableCreateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> id,
      required String clientUuid,
      required String entityType,
      Value<String?> entityId,
      required String payload,
      Value<String?> baseStatus,
      Value<bool?> baseVerified,
      Value<String> status,
      required String clientCreatedAt,
      Value<int> attempts,
      Value<String?> lastError,
    });
typedef $$OutboxTableUpdateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> id,
      Value<String> clientUuid,
      Value<String> entityType,
      Value<String?> entityId,
      Value<String> payload,
      Value<String?> baseStatus,
      Value<bool?> baseVerified,
      Value<String> status,
      Value<String> clientCreatedAt,
      Value<int> attempts,
      Value<String?> lastError,
    });

class $$OutboxTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get clientUuid => $composableBuilder(
    column: $table.clientUuid,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get baseStatus => $composableBuilder(
    column: $table.baseStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get baseVerified => $composableBuilder(
    column: $table.baseVerified,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get clientCreatedAt => $composableBuilder(
    column: $table.clientCreatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get clientUuid => $composableBuilder(
    column: $table.clientUuid,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get baseStatus => $composableBuilder(
    column: $table.baseStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get baseVerified => $composableBuilder(
    column: $table.baseVerified,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get clientCreatedAt => $composableBuilder(
    column: $table.clientCreatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get clientUuid => $composableBuilder(
    column: $table.clientUuid,
    builder: (column) => column,
  );

  GeneratedColumn<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<String> get baseStatus => $composableBuilder(
    column: $table.baseStatus,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get baseVerified => $composableBuilder(
    column: $table.baseVerified,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get clientCreatedAt => $composableBuilder(
    column: $table.clientCreatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);
}

class $$OutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OutboxTable,
          OutboxData,
          $$OutboxTableFilterComposer,
          $$OutboxTableOrderingComposer,
          $$OutboxTableAnnotationComposer,
          $$OutboxTableCreateCompanionBuilder,
          $$OutboxTableUpdateCompanionBuilder,
          (OutboxData, BaseReferences<_$AppDatabase, $OutboxTable, OutboxData>),
          OutboxData,
          PrefetchHooks Function()
        > {
  $$OutboxTableTableManager(_$AppDatabase db, $OutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> clientUuid = const Value.absent(),
                Value<String> entityType = const Value.absent(),
                Value<String?> entityId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<String?> baseStatus = const Value.absent(),
                Value<bool?> baseVerified = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String> clientCreatedAt = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
              }) => OutboxCompanion(
                id: id,
                clientUuid: clientUuid,
                entityType: entityType,
                entityId: entityId,
                payload: payload,
                baseStatus: baseStatus,
                baseVerified: baseVerified,
                status: status,
                clientCreatedAt: clientCreatedAt,
                attempts: attempts,
                lastError: lastError,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String clientUuid,
                required String entityType,
                Value<String?> entityId = const Value.absent(),
                required String payload,
                Value<String?> baseStatus = const Value.absent(),
                Value<bool?> baseVerified = const Value.absent(),
                Value<String> status = const Value.absent(),
                required String clientCreatedAt,
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
              }) => OutboxCompanion.insert(
                id: id,
                clientUuid: clientUuid,
                entityType: entityType,
                entityId: entityId,
                payload: payload,
                baseStatus: baseStatus,
                baseVerified: baseVerified,
                status: status,
                clientCreatedAt: clientCreatedAt,
                attempts: attempts,
                lastError: lastError,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OutboxTable,
      OutboxData,
      $$OutboxTableFilterComposer,
      $$OutboxTableOrderingComposer,
      $$OutboxTableAnnotationComposer,
      $$OutboxTableCreateCompanionBuilder,
      $$OutboxTableUpdateCompanionBuilder,
      (OutboxData, BaseReferences<_$AppDatabase, $OutboxTable, OutboxData>),
      OutboxData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$CachedBeneficiariesTableTableManager get cachedBeneficiaries =>
      $$CachedBeneficiariesTableTableManager(_db, _db.cachedBeneficiaries);
  $$CachedTasksTableTableManager get cachedTasks =>
      $$CachedTasksTableTableManager(_db, _db.cachedTasks);
  $$CachedCampaignsTableTableManager get cachedCampaigns =>
      $$CachedCampaignsTableTableManager(_db, _db.cachedCampaigns);
  $$SyncMetaTableTableManager get syncMeta =>
      $$SyncMetaTableTableManager(_db, _db.syncMeta);
  $$OutboxTableTableManager get outbox =>
      $$OutboxTableTableManager(_db, _db.outbox);
}
