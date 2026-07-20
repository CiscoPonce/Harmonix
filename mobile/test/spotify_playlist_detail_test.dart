import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/playlist_detail_screen.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/spotify/spotify_contracts.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

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
  if (args.identity.provider != 'spotify') {
    return null;
  }
  final items = <SpotifyPlaylistDetailItem>[];
  for (var i = 0; i < args.tracks.length; i++) {
    final t = args.tracks[i];
    items.add(
      SpotifyPlaylistDetailItem(
        position: i,
        title: t['name']?.toString() ?? '',
        artists: t['artists']?.toString() ?? '',
        availability: t['availability']?.toString() ?? 'available',
      ),
    );
  }
  final capped = capSpotifyPlaylistShelf(items);
  final detail = SpotifyPlaylistDetail(
    provider: 'spotify',
    providerId: args.identity.providerId,
    stableId: args.identity.stableId,
    name: args.name,
    restricted: args.restricted,
    detailState: args.restricted ? 'restricted' : (capped.isEmpty ? 'empty' : 'normal'),
    externalUrl: safeSpotifyUrl(args.externalUrl),
    trackCount: args.tracks.length,
    items: capped,
  );
  return PlaylistDetailScreen(
    provider: args.identity.provider,
    providerId: args.identity.providerId,
    playlistName: args.name,
    previewDetail: detail,
    onOpenInSpotify: args.onOpenInSpotify,
  );
}

Widget _harness(Widget child) {
  final client = ApiClient(
    client: MockClient((request) async => http.Response('{}', 200)),
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
    expect(find.text('My Playlist'), findsWidgets);
    expect(find.text('Open in Spotify'), findsOneWidget);
    expect(find.text('Track One'), findsOneWidget);
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
    expect(find.text('No tracks in this playlist'), findsNothing);
  });

  testWidgets('caps Spotify tracks at 20 and uses API-provided external URL only', (tester) async {
    var opened = false;
    final tracks = List.generate(25, (i) => {'name': 'T$i', 'artists': 'A'});
    final detail = buildSpotifyPlaylistDetail(
      SpotifyPlaylistDetailArgs(
        identity: const ProviderIdentity(provider: 'spotify', providerId: 'cap'),
        name: 'Capped',
        tracks: tracks,
        restricted: false,
        externalUrl: 'https://open.spotify.com/playlist/cap',
        onOpenInSpotify: () => opened = true,
      ),
    );
    if (detail == null) {
      fail('$kSentinel: SpotifyPlaylistDetail item cap / external-link missing');
    }
    await tester.pumpWidget(_harness(detail));
    expect(find.text('T0'), findsOneWidget);
    // Scroll through the capped set; the 21st source row must never appear.
    await tester.scrollUntilVisible(find.text('Open in Spotify'), 100);
    expect(find.text('T19'), findsOneWidget);
    expect(find.text('T20'), findsNothing);
    await tester.tap(find.text('Open in Spotify'));
    await tester.pump();
    expect(opened, isTrue);
  });

  testWidgets('rejects navigating by raw ID alone (provider required)', (tester) async {
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
    await tester.pumpWidget(_harness(detail));
    // Unsafe URL must not produce a launchable Open action.
    expect(find.textContaining('Open'), findsNothing);
  });

  test('parsePlaylistDetailDto preserves restricted state and caps items', () {
    final items = List.generate(
      25,
      (i) => {
        'position': i,
        'title': 'T$i',
        'artists': 'A',
        'availability': 'available',
      },
    );
    final detail = parsePlaylistDetailDto({
      'provider': 'spotify',
      'provider_id': 'p1',
      'name': 'N',
      'restricted': false,
      'detail_state': 'normal',
      'external_url': 'https://open.spotify.com/playlist/p1',
      'items': items,
    });
    expect(detail.items.length, 20);
    expect(detail.externalUrl, 'https://open.spotify.com/playlist/p1');

    final restricted = parsePlaylistDetailDto({
      'provider': 'spotify',
      'provider_id': 'p2',
      'name': 'Followed',
      'restricted': true,
      'detail_state': 'restricted',
      'external_url': 'https://open.spotify.com/playlist/p2',
      'items': [],
    });
    expect(restricted.restricted, isTrue);
    expect(restricted.items, isEmpty);
  });
}
