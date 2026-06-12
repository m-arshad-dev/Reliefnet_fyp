/// Client-safe beneficiary (camelCase). The CNIC and its hash NEVER leave the
/// server (api/src/services/beneficiary.service.ts).
class Beneficiary {
  Beneficiary({
    required this.id,
    required this.ngoId,
    required this.fullName,
    required this.householdSize,
    required this.locationId,
    required this.contactMasked,
    required this.verified,
    required this.verifiedBy,
    required this.registeredBy,
    required this.createdAt,
    required this.updatedAt,
  });

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

  factory Beneficiary.fromJson(Map<String, dynamic> json) {
    return Beneficiary(
      id: json['id'] as String,
      ngoId: json['ngoId'] as String,
      fullName: json['fullName'] as String,
      householdSize: json['householdSize'] as int?,
      locationId: json['locationId'] as String?,
      contactMasked: json['contactMasked'] as String?,
      verified: json['verified'] as bool,
      verifiedBy: json['verifiedBy'] as String?,
      registeredBy: json['registeredBy'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }
}

/// One prior aid record under any NGO, as carried by the duplicate flag.
class PriorAid {
  PriorAid({required this.ngo, required this.aidType, required this.deliveredAt});

  final String ngo;
  final String aidType;
  final String deliveredAt;

  factory PriorAid.fromJson(Map<String, dynamic> json) {
    return PriorAid(
      ngo: json['ngo'] as String,
      aidType: json['aidType'] as String,
      deliveredAt: json['deliveredAt'] as String,
    );
  }
}

/// The cross-NGO duplicate flag (v2 §5.4). It FLAGS, never blocks — registration
/// still succeeds (201). `priorAid` lists who gave what aid, when, under any NGO.
class DuplicateFlag {
  DuplicateFlag({
    required this.flagged,
    required this.maskedIdentity,
    required this.priorAid,
  });

  final bool flagged;
  final String? maskedIdentity;
  final List<PriorAid> priorAid;

  factory DuplicateFlag.fromJson(Map<String, dynamic> json) {
    return DuplicateFlag(
      flagged: json['flagged'] as bool,
      maskedIdentity: json['maskedIdentity'] as String?,
      priorAid: (json['priorAid'] as List<dynamic>? ?? const [])
          .map((e) => PriorAid.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// POST /beneficiaries nests the duplicateFlag inside data alongside the created row.
class RegisterBeneficiaryResult {
  RegisterBeneficiaryResult({required this.beneficiary, required this.duplicateFlag});

  final Beneficiary beneficiary;
  final DuplicateFlag duplicateFlag;

  factory RegisterBeneficiaryResult.fromJson(Map<String, dynamic> json) {
    return RegisterBeneficiaryResult(
      beneficiary: Beneficiary.fromJson(json['beneficiary'] as Map<String, dynamic>),
      duplicateFlag: DuplicateFlag.fromJson(json['duplicateFlag'] as Map<String, dynamic>),
    );
  }
}

/// Aid vocabulary — mirrors the server's AID_TYPES (api/src/lib/beneficiaryConstants.ts).
const aidTypes = ['food', 'shelter', 'medical', 'hygiene', 'other'];
