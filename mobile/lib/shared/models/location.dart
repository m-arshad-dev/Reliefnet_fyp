/// Location reference data (camelCase), mirroring the server's PublicLocation
/// (web/src/lib/api/locations.ts). Shared bounded reference data — the endpoint
/// returns the whole tree, no pagination. On mobile it backs the optional region
/// picker on the registration form.
class AppLocation {
  AppLocation({
    required this.id,
    required this.parentId,
    required this.name,
    required this.level,
  });

  final String id;
  final String? parentId;
  final String name;
  final String level;

  factory AppLocation.fromJson(Map<String, dynamic> json) {
    return AppLocation(
      id: json['id'] as String,
      parentId: json['parentId'] as String?,
      name: json['name'] as String,
      level: json['level'] as String,
    );
  }
}

/// Flatten the tree into "Punjab › Lahore › Lahore City (tehsil)" labels for a
/// single indented picker (mirrors web buildLocationOptions).
List<({String id, String label})> buildLocationOptions(List<AppLocation> locations) {
  final byId = {for (final l in locations) l.id: l};
  String pathOf(AppLocation loc) {
    final parts = <String>[loc.name];
    var parent = loc.parentId != null ? byId[loc.parentId] : null;
    while (parent != null) {
      parts.insert(0, parent.name);
      parent = parent.parentId != null ? byId[parent.parentId] : null;
    }
    return parts.join(' › ');
  }

  return locations.map((l) => (id: l.id, label: '${pathOf(l)} (${l.level})')).toList();
}
