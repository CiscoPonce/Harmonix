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
