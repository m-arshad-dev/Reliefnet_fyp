/// Where the mobile client talks to the API. The base URL is a compile-time
/// `--dart-define`, defaulting to the local dev API as reached from an Android
/// emulator.
///
/// `10.0.2.2` is the emulator's alias for the host machine's `localhost`, so a
/// plain `flutter run` reaches an API running on the host at `:4000`. Point at a
/// deployed API without touching this file:
///
///   flutter run --dart-define=API_BASE_URL=https://your-railway-app/api/v1
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000/api/v1',
);
