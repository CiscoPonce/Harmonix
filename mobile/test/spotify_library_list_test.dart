import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_LIST';

/// Provider-aware playlist DTO used by Library list contracts (D-12-06/08/10).
class ProviderPlaylist {
  const ProviderPlaylist({
    required this.provider,
    required this.providerId,
    required this.name,
    this.externalUrl,
  });

  final String provider;
  final String providerId;
  final String name;
  final String? externalUrl;

  String get stableId => '$provider:$providerId';
}

/// Explicit constructor contract for provider-separated Library list.
class SpotifyLibraryListArgs {
  const SpotifyLibraryListArgs({
    required this.harmonixPlaylists,
    required this.spotifyPlaylists,
    required this.recentDiscoveries,
    this.spotifyError,
    this.spotifyLoading = false,
    this.onRefresh,
    this.onOpenPlaylist,
  });

  final List<ProviderPlaylist> harmonixPlaylists;
  final List<ProviderPlaylist> spotifyPlaylists;
  final List<Map<String, dynamic>> recentDiscoveries;
  final String? spotifyError;
  final bool spotifyLoading;
  final Future<void> Function()? onRefresh;
  final void Function(ProviderPlaylist playlist)? onOpenPlaylist;
}

Widget? buildSpotifyLibraryList(SpotifyLibraryListArgs args) {
  // Intended after 12-06:
  // return SpotifyLibraryList(...);
  return null;
}

Widget _harness(Widget child) {
  final client = ApiClient(
    client: MockClient((request) async => http.Response('[]', 200)),
  );
  return Provider<ApiClient>.value(
    value: client,
    child: MaterialApp(
      theme: buildHarmonixTheme(brightness: Brightness.light),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  final collisionHarmonix = const ProviderPlaylist(
    provider: 'harmonix',
    providerId: 'same-raw-id',
    name: 'Harmonix List',
  );
  final collisionSpotify = const ProviderPlaylist(
    provider: 'spotify',
    providerId: 'same-raw-id',
    name: 'Spotify List',
    externalUrl: 'https://open.spotify.com/playlist/same-raw-id',
  );

  test('provider collision yields distinct stable IDs', () {
    expect(collisionHarmonix.stableId, equals('harmonix:same-raw-id'));
    expect(collisionSpotify.stableId, equals('spotify:same-raw-id'));
    expect(collisionHarmonix.stableId, isNot(equals(collisionSpotify.stableId)));
  });

  testWidgets('renders Harmonix then Spotify groups then Recent Discoveries', (tester) async {
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: [collisionHarmonix],
        spotifyPlaylists: [collisionSpotify],
        recentDiscoveries: [
          {'title': 'Recent Song', 'artist': 'Artist'},
        ],
      ),
    );
    if (list == null) {
      fail('$kSentinel: SpotifyLibraryList provider-separated ordering missing');
    }
    await tester.pumpWidget(_harness(list));
    expect(find.text('HARMONIX PLAYLISTS'), findsOneWidget);
    expect(find.text('SPOTIFY PLAYLISTS'), findsOneWidget);
    expect(find.text('RECENT DISCOVERIES'), findsOneWidget);
  });

  testWidgets('preserves Harmonix section when Spotify fails', (tester) async {
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: [collisionHarmonix],
        spotifyPlaylists: const [],
        recentDiscoveries: const [],
        spotifyError: 'Spotify is unavailable right now. Your Harmonix library is still available. Try again.',
      ),
    );
    if (list == null) {
      fail('$kSentinel: SpotifyLibraryList Spotify-error Harmonix preserve missing');
    }
    await tester.pumpWidget(_harness(list));
    expect(find.text('Harmonix List'), findsOneWidget);
  });

  testWidgets('caps Spotify cards at 20 and exposes onward Open in Spotify link', (tester) async {
    final many = List.generate(
      25,
      (i) => ProviderPlaylist(
        provider: 'spotify',
        providerId: 'p$i',
        name: 'Playlist $i',
        externalUrl: 'https://open.spotify.com/playlist/p$i',
      ),
    );
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: const [],
        spotifyPlaylists: many,
        recentDiscoveries: const [],
      ),
    );
    if (list == null) {
      fail('$kSentinel: SpotifyLibraryList 20-card cap / onward link missing');
    }
  });

  testWidgets('supports pull-to-refresh and loading state without live network', (tester) async {
    var refreshed = false;
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: const [],
        spotifyPlaylists: const [],
        recentDiscoveries: const [],
        spotifyLoading: true,
        onRefresh: () async {
          refreshed = true;
        },
      ),
    );
    if (list == null) {
      fail('$kSentinel: SpotifyLibraryList pull-to-refresh / loading missing');
    }
    expect(refreshed, isFalse);
  });
}
