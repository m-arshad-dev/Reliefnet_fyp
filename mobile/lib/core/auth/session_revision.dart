import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A monotonically increasing counter bumped whenever the session dies
/// involuntarily — i.e. the dio interceptor tried to refresh an expired access
/// token and the refresh itself failed (refresh token expired/revoked).
///
/// This is the one-way signal that breaks an otherwise-circular dependency: the
/// dio client depends on token storage + this revision (both dependency-free),
/// and the auth controller listens to this revision to flip itself to
/// logged-out — so dio never has to import the auth controller.
class SessionRevision extends Notifier<int> {
  @override
  int build() => 0;

  void expire() => state = state + 1;
}

final sessionRevisionProvider = NotifierProvider<SessionRevision, int>(SessionRevision.new);
