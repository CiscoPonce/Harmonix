import 'package:url_launcher/url_launcher.dart';

/// Build an open.spotify.com URL for a song (track URI or artist+title search).
/// Matches web `client/src/lib/spotifyOpen.ts`.
String spotifyOpenUrlForSong({
  required String artist,
  required String title,
  String? uri,
}) {
  final m = RegExp(r'^spotify:track:([A-Za-z0-9]+)$').firstMatch(uri ?? '');
  if (m != null) return 'https://open.spotify.com/track/${m.group(1)}';
  final q = [artist, title].where((s) => s.trim().isNotEmpty).join(' ').trim();
  return 'https://open.spotify.com/search/${Uri.encodeComponent(q.isEmpty ? 'music' : q)}';
}

/// Launches Spotify for a given song, prioritizing deep link if Spotify app is installed,
/// and falling back to open.spotify.com.
Future<bool> launchSpotifySong({
  required String artist,
  required String title,
  String? uri,
}) async {
  final rawUri = (uri ?? '').trim();
  // 1. Try deep link if spotify:track:XXX format is available
  if (rawUri.startsWith('spotify:')) {
    final deepLink = Uri.parse(rawUri);
    try {
      if (await launchUrl(deepLink, mode: LaunchMode.externalApplication)) {
        return true;
      }
    } catch (_) {}
  }

  // 2. Try web URL (open.spotify.com/track/... or open.spotify.com/search/...)
  final webUrl = spotifyOpenUrlForSong(artist: artist, title: title, uri: uri);
  final webUri = Uri.parse(webUrl);

  try {
    return await launchUrl(webUri, mode: LaunchMode.externalApplication);
  } catch (_) {
    try {
      return await launchUrl(webUri, mode: LaunchMode.platformDefault);
    } catch (_) {
      return false;
    }
  }
}
