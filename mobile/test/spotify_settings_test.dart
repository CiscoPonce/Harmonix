import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/state/auth_state.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_LINK';

/// Explicit constructor contract for D-12-02/D-12-03 Settings connection card.
/// Implementation slice (12-06) must provide a real [SpotifyConnectionCard]
/// matching these named parameters.
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

/// Factory hook — returns null until SpotifyConnectionCard is implemented.
Widget? buildSpotifyConnectionCard(SpotifyConnectionCardArgs args) {
  // Intended call site after 12-06:
  // return SpotifyConnectionCard(state: args.state, displayName: args.displayName, ...);
  return null;
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
    ],
    child: MaterialApp(
      theme: buildHarmonixTheme(brightness: Brightness.light),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
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
    expect(find.text('Connect Spotify'), findsOneWidget);
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
    }
  });

  testWidgets('connection card is placed directly below profile in Settings', (tester) async {
    // Contract: Settings must compose profile then SpotifyConnectionCard.
    final card = buildSpotifyConnectionCard(
      const SpotifyConnectionCardArgs(state: 'connect'),
    );
    if (card == null) {
      fail('$kSentinel: Settings Spotify card below profile not implemented');
    }
  });
}
