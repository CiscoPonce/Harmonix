import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:harmonix_mobile/widgets/spotify_library_list.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_LIST';

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
    this.onwardUrl,
  });

  final List<ProviderPlaylist> harmonixPlaylists;
  final List<ProviderPlaylist> spotifyPlaylists;
  final List<Map<String, dynamic>> recentDiscoveries;
  final String? spotifyError;
  final bool spotifyLoading;
  final Future<void> Function()? onRefresh;
  final void Function(ProviderPlaylist playlist)? onOpenPlaylist;
  final String? onwardUrl;
}

Widget? buildSpotifyLibraryList(SpotifyLibraryListArgs args) {
  return SpotifyLibraryList(
    harmonixPlaylists: args.harmonixPlaylists,
    spotifyPlaylists: args.spotifyPlaylists,
    recentDiscoveries: args.recentDiscoveries,
    spotifyError: args.spotifyError,
    spotifyLoading: args.spotifyLoading,
    onwardUrl: args.onwardUrl,
    onRefresh: args.onRefresh,
    onOpenPlaylist: args.onOpenPlaylist,
  );
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
    songCount: 3,
  );
  final collisionSpotify = const ProviderPlaylist(
    provider: 'spotify',
    providerId: 'same-raw-id',
    name: 'Spotify List',
    externalUrl: 'https://open.spotify.com/playlist/same-raw-id',
    trackCount: 12,
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

    final hY = tester.getTopLeft(find.text('HARMONIX PLAYLISTS')).dy;
    final sY = tester.getTopLeft(find.text('SPOTIFY PLAYLISTS')).dy;
    final rY = tester.getTopLeft(find.text('RECENT DISCOVERIES')).dy;
    expect(hY, lessThan(sY));
    expect(sY, lessThan(rY));
    expect(find.text('Harmonix List'), findsOneWidget);
    expect(find.text('Spotify List'), findsOneWidget);
    expect(find.text('1 song'), findsNothing);
    expect(find.text('3 songs'), findsOneWidget);
    expect(find.text('12 tracks'), findsOneWidget);
  });

  testWidgets('preserves Harmonix section when Spotify fails', (tester) async {
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: [collisionHarmonix],
        spotifyPlaylists: const [],
        recentDiscoveries: const [],
        spotifyError:
            'Spotify is unavailable right now. Your Harmonix library is still available. Try again.',
      ),
    );
    if (list == null) {
      fail('$kSentinel: SpotifyLibraryList Spotify-error Harmonix preserve missing');
    }
    await tester.pumpWidget(_harness(list));
    expect(find.text('Harmonix List'), findsOneWidget);
    expect(find.textContaining('Spotify is unavailable'), findsOneWidget);
    expect(find.text('Connect Spotify'), findsNothing);
  });

  testWidgets('caps Spotify cards at 20 and exposes onward Open in Spotify link', (tester) async {
    final many = List.generate(
      25,
      (i) => ProviderPlaylist(
        provider: 'spotify',
        providerId: 'p$i',
        name: 'Playlist $i',
        externalUrl: 'https://open.spotify.com/playlist/p$i',
        trackCount: 1,
      ),
    );
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: const [],
        spotifyPlaylists: many,
        recentDiscoveries: const [],
        onwardUrl: 'https://open.spotify.com/collection/playlists',
      ),
    );
    if (list == null) {
      fail('$kSentinel: SpotifyLibraryList 20-card cap / onward link missing');
    }
    await tester.pumpWidget(_harness(list));
    expect(find.text('Playlist 0'), findsOneWidget);
    expect(find.text('Playlist 20'), findsNothing);
    // Scroll to the shelf end — 20th card + onward action.
    await tester.scrollUntilVisible(
      find.text('Open more playlists in Spotify'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Playlist 19'), findsOneWidget);
    expect(find.text('Open more playlists in Spotify'), findsOneWidget);
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
    await tester.pumpWidget(_harness(list));
    expect(find.byType(RefreshIndicator), findsOneWidget);
    await tester.fling(find.byType(RefreshIndicator), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();
    expect(refreshed, isTrue);
  });

  testWidgets('long playlist names truncate in cards', (tester) async {
    final longName = 'A' * 80;
    final list = buildSpotifyLibraryList(
      SpotifyLibraryListArgs(
        harmonixPlaylists: [
          ProviderPlaylist(
            provider: 'harmonix',
            providerId: 'long',
            name: longName,
            songCount: 1,
          ),
        ],
        spotifyPlaylists: const [],
        recentDiscoveries: const [],
      ),
    )!;
    await tester.pumpWidget(_harness(list));
    expect(find.text('1 song'), findsOneWidget);
    final text = tester.widget<Text>(find.text(longName));
    expect(text.maxLines, 1);
    expect(text.overflow, TextOverflow.ellipsis);
  });
}
