/// Client-safe user projection (camelCase), mirroring the server's PublicUser
/// (api/src/services/auth.service.ts). `ngoId` is null for global roles
/// (system_admin / auditor) — field roles always carry one.
class User {
  User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    required this.ngoId,
  });

  final String id;
  final String email;
  final String fullName;
  final String role;
  final String? ngoId;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['fullName'] as String,
      role: json['role'] as String,
      ngoId: json['ngoId'] as String?,
    );
  }
}

/// The field roles this client serves (v2 §6.1). Used to gate which screens the
/// UI offers — the API re-enforces every permission regardless.
class FieldRoles {
  static const fieldCoordinator = 'field_coordinator';
  static const volunteer = 'volunteer';
  static const dataEntry = 'data_entry';

  static const all = {fieldCoordinator, volunteer, dataEntry};

  /// Only the coordinator can read campaigns + register/verify, so it's the role
  /// the registration screen is built around (the other two can't list campaigns).
  static bool canRegister(String role) => role == fieldCoordinator;
  static bool canViewTasks(String role) => role == fieldCoordinator || role == volunteer;
}
