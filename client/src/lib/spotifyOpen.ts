/**
 * Build an open.spotify.com URL for a song (track URI or artist+title search).
 * Used for "Open song" links — never Apple Music / in-app iTunes player routes.
 */

export function spotifyOpenUrlForSong(
  artist: string,
  title: string,
  uri?: string | null
): string {
  const m = String(uri || '').match(/^spotify:track:([A-Za-z0-9]+)$/);
  if (m) return `https://open.spotify.com/track/${m[1]}`;
  const q = [artist, title].filter(Boolean).join(' ').trim();
  return `https://open.spotify.com/search/${encodeURIComponent(q || 'music')}`;
}
