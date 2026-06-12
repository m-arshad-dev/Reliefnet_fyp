// Slice 7 Task FSM — the mobile mirror of the server's task vocabulary and FSM,
// ported verbatim from web/src/lib/api/tasks.ts (which itself mirrors
// api/src/services/task.service.ts). The server is authoritative and re-validates
// everything; these mirrors only drive which buttons the UI offers.

class Task {
  Task({
    required this.id,
    required this.ngoId,
    required this.campaignId,
    required this.title,
    required this.description,
    required this.locationId,
    required this.status,
    required this.rejectionCount,
    required this.assignedTo,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });

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

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'] as String,
      ngoId: json['ngoId'] as String,
      campaignId: json['campaignId'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      locationId: json['locationId'] as String?,
      status: json['status'] as String,
      rejectionCount: json['rejectionCount'] as int,
      assignedTo: json['assignedTo'] as String?,
      createdBy: json['createdBy'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }
}

class TaskTransition {
  TaskTransition({
    required this.id,
    required this.taskId,
    required this.fromStatus,
    required this.toStatus,
    required this.actorId,
    required this.note,
    required this.createdAt,
  });

  final String id;
  final String taskId;
  final String? fromStatus;
  final String toStatus;
  final String actorId;
  final String? note;
  final String createdAt;

  factory TaskTransition.fromJson(Map<String, dynamic> json) {
    return TaskTransition(
      id: json['id'] as String,
      taskId: json['taskId'] as String,
      fromStatus: json['fromStatus'] as String?,
      toStatus: json['toStatus'] as String,
      actorId: json['actorId'] as String,
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }
}

/// Mirror of the server FSM — so a row only renders legal next states. 'escalated'
/// is never a requestable target (it's reached only via the rejection-cap redirect).
const Map<String, List<String>> taskTransitions = {
  'created': ['assigned'],
  'assigned': ['in_progress'],
  'in_progress': ['pending_verification'],
  'pending_verification': ['completed', 'rejected'],
  'rejected': ['assigned'],
  'escalated': ['assigned'],
  'completed': [],
};

/// Mirror of the server's EDGE_PERMISSIONS, as the roles allowed to drive each
/// edge — so the UI enables/disables an action per the current role.
/// (task:create/escalate → ngo_admin+field_coordinator; task:execute → volunteer.)
const Map<String, List<String>> _edgeRoles = {
  'created->assigned': ['ngo_admin', 'field_coordinator'],
  'assigned->in_progress': ['volunteer'],
  'in_progress->pending_verification': ['volunteer'],
  'pending_verification->completed': ['ngo_admin', 'field_coordinator'],
  'pending_verification->rejected': ['ngo_admin', 'field_coordinator'],
  'rejected->assigned': ['ngo_admin', 'field_coordinator'],
  'escalated->assigned': ['ngo_admin', 'field_coordinator'],
};

bool canTransition(String role, String from, String to) {
  return _edgeRoles['$from->$to']?.contains(role) ?? false;
}

/// The assign edges (created/rejected/escalated -> assigned) carry an assignee.
bool isAssignEdge(String to) => to == 'assigned';

/// Human label for an edge — 'assigned' is context-dependent (assign / reassign / reset).
String actionLabel(String from, String to) {
  if (to == 'assigned') {
    if (from == 'created') return 'Assign';
    if (from == 'escalated') return 'Reset & reassign';
    return 'Reassign';
  }
  const labels = {
    'in_progress': 'Start',
    'pending_verification': 'Submit for verification',
    'completed': 'Mark complete',
    'rejected': 'Reject',
  };
  return labels[to] ?? to;
}
