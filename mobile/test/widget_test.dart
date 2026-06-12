// Unit tests for the ported task FSM helpers (shared/models/task.dart). These
// mirror api/src/services/task.service.ts; the server stays authoritative, but
// the mobile UI relies on these to offer only legal, role-appropriate actions.

import 'package:flutter_test/flutter_test.dart';
import 'package:reliefnet_mobile/shared/models/task.dart';

void main() {
  group('taskTransitions', () {
    test('only legal next states are listed', () {
      expect(taskTransitions['created'], ['assigned']);
      expect(taskTransitions['pending_verification'], ['completed', 'rejected']);
      expect(taskTransitions['completed'], isEmpty);
      // 'escalated' is reachable only via the rejection cap, never a requestable target.
      expect(taskTransitions.values.expand((e) => e).contains('escalated'), isFalse);
    });
  });

  group('canTransition (per-edge role gate)', () {
    test('execute edges belong to the volunteer', () {
      expect(canTransition('volunteer', 'assigned', 'in_progress'), isTrue);
      expect(canTransition('volunteer', 'in_progress', 'pending_verification'), isTrue);
      // A coordinator cannot drive the execute edges.
      expect(canTransition('field_coordinator', 'assigned', 'in_progress'), isFalse);
    });

    test('manage edges belong to the coordinator', () {
      expect(canTransition('field_coordinator', 'pending_verification', 'completed'), isTrue);
      expect(canTransition('field_coordinator', 'pending_verification', 'rejected'), isTrue);
      expect(canTransition('field_coordinator', 'escalated', 'assigned'), isTrue);
      // A volunteer cannot verify/reject.
      expect(canTransition('volunteer', 'pending_verification', 'completed'), isFalse);
    });
  });

  group('actionLabel', () {
    test('assign edge is context-dependent', () {
      expect(actionLabel('created', 'assigned'), 'Assign');
      expect(actionLabel('rejected', 'assigned'), 'Reassign');
      expect(actionLabel('escalated', 'assigned'), 'Reset & reassign');
    });

    test('execute/verify labels', () {
      expect(actionLabel('assigned', 'in_progress'), 'Start');
      expect(actionLabel('in_progress', 'pending_verification'), 'Submit for verification');
      expect(actionLabel('pending_verification', 'completed'), 'Mark complete');
    });
  });

  // Slice 12 — the optimistic offline prediction must mirror the server FSM + rejection cap,
  // so the cached row a field user sees matches what the server will apply on sync.
  group('predictTransition (optimistic offline outcome)', () {
    test('a normal edge keeps the count and lands on the target', () {
      final r = predictTransition('in_progress', 0);
      expect(r.status, 'in_progress');
      expect(r.rejectionCount, 0);
    });

    test('a rejection increments the persisted count', () {
      final r = predictTransition('rejected', 0);
      expect(r.status, 'rejected');
      expect(r.rejectionCount, 1);
    });

    test('the third rejection redirects to escalated (cap)', () {
      final r = predictTransition('rejected', 2);
      expect(r.status, 'escalated');
      expect(r.rejectionCount, 3);
    });
  });
}
