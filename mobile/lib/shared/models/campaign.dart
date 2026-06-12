/// Campaign (camelCase), mirroring the server projection (web/src/lib/api/campaigns.ts).
/// On mobile this only backs the registration screen's campaign picker; the
/// coordinator is the only field role that may read campaigns.
class Campaign {
  Campaign({
    required this.id,
    required this.ngoId,
    required this.disasterId,
    required this.name,
    required this.targetRegionId,
    required this.startsOn,
    required this.endsOn,
    required this.status,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String ngoId;
  final String disasterId;
  final String name;
  final String? targetRegionId;
  final String startsOn;
  final String? endsOn;
  final String status;
  final String createdBy;
  final String createdAt;
  final String updatedAt;

  factory Campaign.fromJson(Map<String, dynamic> json) {
    return Campaign(
      id: json['id'] as String,
      ngoId: json['ngoId'] as String,
      disasterId: json['disasterId'] as String,
      name: json['name'] as String,
      targetRegionId: json['targetRegionId'] as String?,
      startsOn: json['startsOn'] as String,
      endsOn: json['endsOn'] as String?,
      status: json['status'] as String,
      createdBy: json['createdBy'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }
}
