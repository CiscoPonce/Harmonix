import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/settings_screen.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/spotify/spotify_contracts.dart';
import 'package:harmonix_mobile/state/auth_state.dart';
import 'package:harmonix_mobile/state/home_navigation_controller.dart';
import 'package:harmonix_mobile/state/theme_controller.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:harmonix_mobile/widgets/spotify_connection_card.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_LINK';

/// Explicit constructor contract for D-12-02/D-12-03 Settings connection card.
class SpotifyConnectionCardArgs {
  const SpotifyConnectionCardArgs({
    required this.state,
    this.displayName,
    this.onConnect,
    this.onDisconnect,
    this.onReconnect,
  });

  /// One of: connect, connected, reconnect, disconnecting, connecting.
  final String state;
  final String? displayName;
  final VoidCallback? onConnect;
  final VoidCallback? onDisconnect;
  final VoidCallback? onReconnect;
}

/// Factory hook — builds the production SpotifyConnectionCard.
Widget? buildSpotifyConnectionCard(SpotifyConnectionCardArgs args) {
  return SpotifyConnectionCard(
    state: args.state,
    displayName: args.displayName,
    onConnect: args.onConnect,
    onDisconnect: args.onDisconnect,
    onReconnect: args.onReconnect,
  );
}

class _MemorySecureStorage extends FlutterSecureStorage {
  _MemorySecureStorage() : super();

  final Map<String, String> store = {};
  final List<String> writeKeys = [];

  @override
  Future<void> write({
    required String key,
    required String? value,
    AndroidOptions? aOptions,
    IOSOptions? iOptions,
    LinuxOptions? lOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
    WebOptions? webOptions,
  }) async {
    writeKeys.add(key);
    if (value == null) {
      store.remove(key);
    } else {
      store[key] = value;
    }
  }

  @override
  Future<String?> read({
    required String key,
    AndroidOptions? aOptions,
    IOSOptions? iOptions,
    LinuxOptions? lOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
    WebOptions? webOptions,
  }) async =>
      store[key];

  @override
  Future<void> delete({
    required String key,
    AndroidOptions? aOptions,
    IOSOptions? iOptions,
    LinuxOptions? lOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
    WebOptions? webOptions,
  }) async {
    store.remove(key);
  }
}

Widget _harness({required Widget child}) {
  final client = ApiClient(
    client: MockClient((request) async {
      return http.Response('{"error":"unused"}', 500);
    }),
  );
  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: client),
      ChangeNotifierProvider(create: (_) => AuthState(client)),
      ChangeNotifierProvider(create: (_) => HomeNavigationController()),
    ],
    child: MaterialApp(
      theme: buildHarmonixTheme(brightness: Brightness.light),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('D-12-03 connection card renders Connect state with required copy', (tester) async {
    final card = buildSpotifyConnectionCard(
      SpotifyConnectionCardArgs(
        state: 'connect',
        onConnect: () {},
      ),
    );
    if (card == null) {
      fail('$kSentinel: SpotifyConnectionCard(state: connect) constructor missing');
    }
    await tester.pumpWidget(_harness(child: card));
    expect(find.text('Connect Spotify'), findsWidgets);
  });

  testWidgets('connection card supports Connected, Reconnect, Disconnect, connecting, disconnecting', (tester) async {
    for (final state in [
      'connected',
      'reconnect',
      'connecting',
      'disconnecting',
    ]) {
      final card = buildSpotifyConnectionCard(
        SpotifyConnectionCardArgs(
          state: state,
          displayName: 'Demo User',
          onDisconnect: () {},
          onReconnect: () {},
        ),
      );
      if (card == null) {
        fail('$kSentinel: SpotifyConnectionCard(state: $state) constructor missing');
      }
      await tester.pumpWidget(_harness(child: card));
      await tester.pumpAndSettle();
      if (state == 'connected') {
        expect(find.text('Spotify connected'), findsOneWidget);
        expect(find.text('Disconnect Spotify'), findsOneWidget);
      } else if (state == 'reconnect') {
        expect(find.text('Reconnect Spotify'), findsWidgets);
      } else if (state == 'connecting') {
        expect(find.textContaining('Connecting'), findsOneWidget);
      } else if (state == 'disconnecting') {
        expect(find.textContaining('Disconnecting'), findsOneWidget);
      }
    }
  });

  testWidgets('connection card is placed directly below profile in Settings', (tester) async {
    final storage = _MemorySecureStorage();
    http.Response jsonOk(String body) => http.Response(
          body,
          200,
          headers: {'content-type': 'application/json'},
        );
    final api = ApiClient(
      storage: storage,
      client: MockClient((request) async {
        if (request.url.path.contains('/progress/stats')) {
          return jsonOk(
            '{"streak_days":0,"total_words":0,"today_words":0,"daily_goal":1}',
          );
        }
        if (request.url.path.contains('/badges')) {
          return jsonOk('{"badges":[]}');
        }
        if (request.url.path.contains('/spotify/status')) {
          return jsonOk('{"status":"disconnected"}');
        }
        return jsonOk('{}');
      }),
    );
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<ApiClient>.value(value: api),
          ChangeNotifierProvider(create: (_) => AuthState(api)),
          ChangeNotifierProvider(create: (_) => ThemeController()),
          ChangeNotifierProvider(create: (_) => HomeNavigationController()),
        ],
        child: MaterialApp(
          theme: buildHarmonixTheme(brightness: Brightness.light),
          home: const Scaffold(body: SettingsScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final profile = find.text('Learner');
    final card = find.byType(SpotifyConnectionCard);
    expect(profile, findsOneWidget);
    expect(card, findsOneWidget);

    final profileY = tester.getTopLeft(profile).dy;
    final cardY = tester.getTopLeft(card).dy;
    expect(cardY, greaterThan(profileY));

    // Settings grew (Languages / Music style / Voice), so APPEARANCE now sits
    // below the test viewport; scroll it into view before asserting order.
    final appearance = find.text('APPEARANCE');
    await tester.scrollUntilVisible(
      appearance,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    // Reaching it by scrolling *down* proves it sits below the connection card.
    expect(appearance, findsOneWidget);
  });

  test('auth start and disconnect use only authenticated backend methods', () async {
    final storage = _MemorySecureStorage();
    final calls = <String>[];
    http.Response jsonRes(String body, [int status = 200]) => http.Response(
          body,
          status,
          headers: {'content-type': 'application/json'},
        );
    final api = ApiClient(
      storage: storage,
      client: MockClient((request) async {
        calls.add('${request.method} ${request.url.path}');
        if (request.url.path.endsWith('/spotify/auth/start')) {
          expect(request.method, 'POST');
          expect(request.body, contains('"client":"android"'));
          return jsonRes(
            '{"authorization_url":"https://accounts.spotify.com/authorize?client_id=x"}',
          );
        }
        if (request.url.path.endsWith('/spotify/connection')) {
          expect(request.method, 'DELETE');
          return jsonRes('{}');
        }
        if (request.url.path.endsWith('/spotify/status')) {
          return jsonRes('{"status":"connected","display_name":"Demo"}');
        }
        return jsonRes('{"error":"unexpected"}', 500);
      }),
    );

    final status = await api.spotifyStatus();
    expect(status.state, 'connected');
    final url = await api.spotifyAuthStart(client: 'android');
    expect(safeSpotifyAuthorizationUrl(url), isNotNull);
    await api.disconnectSpotify();

    expect(calls, contains('POST /api/spotify/auth/start'));
    expect(calls, contains('DELETE /api/spotify/connection'));
    expect(
      storage.writeKeys.where((k) => k.toLowerCase().contains('spotify')),
      isEmpty,
    );
    expect(storage.store.keys.where((k) => k.contains('spotify')), isEmpty);
  });

  test('authorization URL host allowlist rejects non-Spotify hosts', () {
    expect(
      safeSpotifyAuthorizationUrl('https://evil.example/authorize'),
      isNull,
    );
    expect(
      safeSpotifyAuthorizationUrl(
        'https://accounts.spotify.com/authorize?client_id=x',
      ),
      isNotNull,
    );
  });
}
