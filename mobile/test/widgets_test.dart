// Widget tests for the three Slice-11 DoD-critical UI pieces:
//   1. LoginScreen renders the sign-in form and validates required fields
//      without ever hitting the network (the auth provider is never read).
//   2. DuplicateBanner surfaces the masked identity + prior aid when flagged
//      (the cross-NGO duplicate flag — flags, never blocks).
//   3. TransitionButtons renders ONLY the legal next states and enables a button
//      ONLY for the role that owns that edge (mirrors the server's per-edge gate).
//
// These complement the FSM helper unit tests in widget_test.dart.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:reliefnet_mobile/features/auth/login_screen.dart';
import 'package:reliefnet_mobile/features/tasks/task_detail_screen.dart';
import 'package:reliefnet_mobile/shared/models/beneficiary.dart';
import 'package:reliefnet_mobile/shared/models/task.dart';
import 'package:reliefnet_mobile/shared/theme.dart';
import 'package:reliefnet_mobile/shared/widgets/duplicate_banner.dart';

Widget _wrap(Widget child) => ProviderScope(
      child: MaterialApp(theme: buildAppTheme(), home: child),
    );

Task _task({required String status, int rejectionCount = 0}) => Task(
      id: 't1',
      ngoId: 'n1',
      campaignId: 'c1',
      title: 'Distribute tents',
      description: null,
      locationId: null,
      status: status,
      rejectionCount: rejectionCount,
      assignedTo: null,
      createdBy: 'u1',
      createdAt: '2026-06-12T00:00:00Z',
      updatedAt: '2026-06-12T00:00:00Z',
    );

List<FilledButton> _filledButtons(WidgetTester tester) =>
    tester.widgetList<FilledButton>(find.byType(FilledButton)).toList();

void main() {
  group('LoginScreen', () {
    testWidgets('renders the sign-in form', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      expect(find.text('RELIEFNET'), findsOneWidget);
      expect(find.text('Field Client'), findsOneWidget);
      expect(find.text('Email'), findsOneWidget); // field label
      expect(find.text('Password'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    });

    testWidgets('validates required fields without calling the API', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pump();

      // Submit short-circuits on validation failure BEFORE touching the auth
      // provider — so this proves the form guards without any network mock.
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });
  });

  group('DuplicateBanner', () {
    testWidgets('renders masked identity and prior aid when flagged', (tester) async {
      final flag = DuplicateFlag(
        flagged: true,
        maskedIdentity: '*****-*****3-3',
        priorAid: [
          PriorAid(
            ngo: 'Crescent Aid Network',
            aidType: 'food',
            deliveredAt: '2026-06-01T00:00:00Z',
          ),
        ],
      );

      await tester.pumpWidget(_wrap(Scaffold(body: DuplicateBanner(flag))));

      expect(find.textContaining('Possible duplicate'), findsOneWidget);
      expect(find.textContaining('*****-*****3-3'), findsOneWidget);
      expect(find.textContaining('Crescent Aid Network'), findsOneWidget);
      expect(find.textContaining('food'), findsOneWidget);
    });
  });

  group('Task FSM buttons (TransitionButtons)', () {
    Future<void> pump(WidgetTester tester, {required String status, required String role}) async {
      await tester.pumpWidget(_wrap(Scaffold(
        body: TransitionButtons(
          task: _task(status: status),
          role: role,
          working: false,
          onTransition: (_) {},
        ),
      )));
    }

    testWidgets('coordinator on pending_verification gets enabled Verify + Reject', (tester) async {
      await pump(tester, status: 'pending_verification', role: 'field_coordinator');

      final buttons = _filledButtons(tester);
      expect(buttons.length, 2); // only the two legal next states
      expect(buttons.every((b) => b.onPressed != null), isTrue);
      expect(find.text('Mark complete'), findsOneWidget);
      expect(find.text('Reject'), findsOneWidget);
      // an illegal next state (e.g. in_progress) is never offered
      expect(find.text('Start'), findsNothing);
    });

    testWidgets('volunteer on pending_verification sees the same buttons but disabled', (tester) async {
      await pump(tester, status: 'pending_verification', role: 'volunteer');

      final buttons = _filledButtons(tester);
      expect(buttons.length, 2);
      expect(buttons.every((b) => b.onPressed == null), isTrue); // not their edge
    });

    testWidgets('volunteer on assigned can Start; coordinator cannot', (tester) async {
      await pump(tester, status: 'assigned', role: 'volunteer');
      var buttons = _filledButtons(tester);
      expect(buttons.length, 1);
      expect(find.text('Start'), findsOneWidget);
      expect(buttons.single.onPressed, isNotNull);

      await pump(tester, status: 'assigned', role: 'field_coordinator');
      buttons = _filledButtons(tester);
      expect(buttons.single.onPressed, isNull); // execute edge isn't the coordinator's
    });

    testWidgets('completed task offers no actions', (tester) async {
      await pump(tester, status: 'completed', role: 'field_coordinator');

      expect(find.byType(FilledButton), findsNothing);
      expect(find.textContaining('No further actions'), findsOneWidget);
    });
  });
}
