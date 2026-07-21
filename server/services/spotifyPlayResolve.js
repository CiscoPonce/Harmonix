'use strict';

/**
 * Resolve a playable Spotify track URI for in-app playback.
 * Stricter export matching first; looser search fallback for Hear-it / full player.
 */

const spotifyService = require('./spotifyService');
const {
  resolveSpotifyMatch,
  buildSearchQuery,
  normalizeTrackIdentity,
  normText,
  titleBase,
} = require('./spotifyMatchService');

function providerError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function titlesRoughlyMatch(a, b) {
  const na = titleBase(a);
  const nb = titleBase(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function artistsOverlap(sourceArtist, candidateArtists) {
  const src = normText(sourceArtist);
  if (!src) return true;
  const cand = Array.isArray(candidateArtists)
    ? candidateArtists.map((a) => normText(a?.name || a)).filter(Boolean)
    : [normText(candidateArtists)];
  if (!cand.length) return false;
  return cand.some((c) => src.includes(c) || c.includes(src.split(' ')[0]));
}

/**
 * @param {string} userId
 * @param {{ title: string, artist: string, duration_ms?: number|null, song_id?: string|null }} source
 */
async function resolvePlayableSpotifyTrack(userId, source) {
  const status = spotifyService.getConnectionStatus(userId);
  if (status.status === 'disconnected') {
    throw providerError('spotify_disconnected', 'Spotify is not connected');
  }
  if (status.status === 'reconnect_required') {
    throw providerError('reconnect_required', 'Spotify reconnect required', {
      reason: status.reason || 'reconnect_required',
    });
  }

  // Ensure playback scopes before searching (same gate as player token).
  // Scope check only — avoid issuePlayerAccess here (races player/token + admission).
  const scopeGate = spotifyService.assertPlaybackScopesReady(userId);
  if (scopeGate) throw scopeGate;

  const title = String(source.title || '').trim();
  const artist = String(source.artist || '').trim();
  if (!title || !artist) {
    throw providerError('invalid_request', 'title and artist are required');
  }

  const identity =
    source.song_id != null && String(source.song_id).trim()
      ? `harmonix:${String(source.song_id).trim()}`
      : `play:${normText(title)}|${normText(artist)}`;

  const matchSource = normalizeTrackIdentity({
    song_id: source.song_id || null,
    identity,
    title,
    artist,
    duration_ms: source.duration_ms ?? null,
  });

  try {
    const matched = await resolveSpotifyMatch(userId, matchSource, {});
    if (matched && matched.outcome === 'accept' && matched.spotify_uri) {
      return {
        provider: 'spotify',
        uri: matched.spotify_uri,
        title: matched.matched_title || title,
        artists: matched.matched_artists || artist,
        match: 'strict',
      };
    }
  } catch (err) {
    // Fall through to loose search for playback UX.
    if (err && (err.code === 'spotify_disconnected' || err.code === 'reconnect_required')) {
      throw err;
    }
  }

  const query = buildSearchQuery({ title, artist });
  const items = await spotifyService.searchTracks(userId, query, { limit: 5 });
  for (const item of items) {
    if (!item || !item.uri) continue;
    const candTitle = item.name || '';
    const candArtists = Array.isArray(item.artists) ? item.artists : [];
    if (!titlesRoughlyMatch(title, candTitle)) continue;
    if (!artistsOverlap(artist, candArtists)) continue;
    return {
      provider: 'spotify',
      uri: item.uri,
      title: candTitle,
      artists: candArtists.map((a) => a.name).filter(Boolean).join(', '),
      match: 'loose',
    };
  }

  // Last resort: first search hit with any URI (better than silence when Spotify is preferred).
  const first = items.find((i) => i && i.uri);
  if (first) {
    return {
      provider: 'spotify',
      uri: first.uri,
      title: first.name || title,
      artists: (first.artists || []).map((a) => a.name).filter(Boolean).join(', '),
      match: 'fallback',
    };
  }

  throw providerError('not_found', 'No Spotify track match for playback');
}

module.exports = {
  resolvePlayableSpotifyTrack,
};
