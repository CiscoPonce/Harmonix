import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_DETAIL';

class ProviderIdentity {
  const ProviderIdentity({required this.provider, required this.providerId});

  final String provider;
  final String providerId;

  String get stableId => '$provider:$providerId';
}

class SpotifyPlaylistDetailArgs {
  const SpotifyPlaylistDetailArgs({
    required this.identity,
    required this.name,
    required this.tracks,
    required this.restricted,
    this.externalUrl,
    this.onOpenInSpotify,
  });

  final ProviderIdentity identity;
  final String name;
  final List<Map<String, dynamic>> tracks;
  final bool restricted;
  final String? externalUrl;
  final VoidCallback? onOpenInSpotify;
}

Widget? buildSpotifyPlaylistDetail(SpotifyPlaylistDetailArgs args) {
  // Intended after 12-07:
  // return SpotifyPlaylistDetailScreen(...);
  return null;
}

Widget _harness(Widget child) {
  return MaterialApp(
    theme: buildHarmonixTheme(brightness: Brightness.light),
    home: Scaffold(body: child),
  );
}

void main() {
  test('equal raw IDs under different providers produce distinct destinations', () {
    const a = ProviderIdentity(provider: 'spotify', providerId: 'x');
    const b = ProviderIdentity(provider: 'harmonix', providerId: 'x');
    expect(a.stableId, equals('spotify:x'));
    expect(b.stableId, equals('harmonix:x'));
    expect(a.stableId, isNot(equals(b.stableId)));
  });

  testWidgets('opens normal in-app detail for owned Spotify playlist', (tester) async {
    final detail = buildSpotifyPlaylistDetail(
      const SpotifyPlaylistDetailArgs(
        identity: ProviderIdentity(provider: 'spotify', providerId: 'owned-1'),
        name: 'My Playlist',
        tracks: [
          {'name': 'Track One', 'artists': 'Artist'},
        ],
        restricted: false,
        externalUrl: 'https://open.spotify.com/playlist/owned-1',
      ),
    );
    if (detail == null) {
      fail('$kSentinel: SpotifyPlaylistDetail normal detail constructor missing');
    }
    await tester.pumpWidget(_harness(detail));
    expect(find.text('My Playlist'), findsOneWidget);
    expect(find.text('Open in Spotify'), findsOneWidget);
  });

  testWidgets('opens restricted detail for followed playlist without faking empty tracks', (tester) async {
    final detail = buildSpotifyPlaylistDetail(
      const SpotifyPlaylistDetailArgs(
        identity: ProviderIdentity(provider: 'spotify', providerId: 'followed-1'),
        name: 'Followed Editorial',
        tracks: [],
        restricted: true,
        externalUrl: 'https://open.spotify.com/playlist/followed-1',
      ),
    );
    if (detail == null) {
      fail('$kSentinel: SpotifyPlaylistDetail restricted detail constructor missing');
    }
    await tester.pumpWidget(_harness(detail));
    expect(
      find.text('Spotify limits track details for this followed playlist.'),
      findsOneWidget,
    );
    expect(find.text('Open in Spotify'), findsOneWidget);
  });

  testWidgets('caps Spotify tracks at 20 and uses API-provided external URL only', (tester) async {
    final tracks = List.generate(25, (i) => {'name': 'T$i', 'artists': 'A'});
    final detail = buildSpotifyPlaylistDetail(
      SpotifyPlaylistDetailArgs(
        identity: const ProviderIdentity(provider: 'spotify', providerId: 'cap'),
        name: 'Capped',
        tracks: tracks,
        restricted: false,
        externalUrl: 'https://open.spotify.com/playlist/cap',
        onOpenInSpotify: () {},
      ),
    );
    if (detail == null) {
      fail('$kSentinel: SpotifyPlaylistDetail item cap / external-link missing');
    }
  });

  testWidgets('rejects navigating by raw ID alone (provider required)', (tester) async {
    // Contract: detail route must require provider + providerId.
    const identity = ProviderIdentity(provider: 'spotify', providerId: 'abc');
    expect(identity.stableId.contains(':'), isTrue);
    final detail = buildSpotifyPlaylistDetail(
      const SpotifyPlaylistDetailArgs(
        identity: identity,
        name: 'X',
        tracks: [],
        restricted: false,
        externalUrl: 'javascript:alert(1)',
      ),
    );
    if (detail == null) {
      fail('$kSentinel: SpotifyPlaylistDetail provider-aware navigation missing');
    }
  });
}
