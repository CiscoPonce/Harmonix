'use strict';

const db = require('../db');

const SEARCH_LIMIT = 10;
const ACCEPT_SCORE = 70;
const TIE_EPSILON = 2;
const DURATION_HARD_MS = 15_000;
const MATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MATCH_KEY_VERSION = 'v1';
// Real Spotify IDs are base62; fixtures may use hyphenated placeholders.
const SPOTIFY_TRACK_URI_RE = /^spotify:track:[A-Za-z0-9._-]+$/;

const EDITION_RE =
  /\b(live|remaster(?:ed)?|remix|acoustic|karaoke|instrumental|deluxe|radio\s*edit|edit|version)\b/i;

function parseCachePolicy() {
  const raw = process.env.SPOTIFY_MATCH_CACHE_POLICY || 'ttl=7d;revalidate_on_export;delete_on_disconnect';
  return {
    ttlMs: MATCH_TTL_MS,
    revalidateOnExport: /revalidate/i.test(raw),
    deleteOnDisconnect: /delete_on_disconnect/i.test(raw),
    raw,
  };
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFeaturing(s) {
  return String(s || '')
    .replace(/\s*[([{]\s*(feat\.?|ft\.?|featuring)\b[^)\]}]*[)\]}]/gi, '')
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.+$/gi, '')
    .trim();
}

function splitArtists(artistField) {
  const raw = String(artistField || '');
  const parts = raw
    .split(/\s*(?:,|&|\/|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)\s*/i)
    .map((p) => normText(p))
    .filter(Boolean);
  return [...new Set(parts)];
}

function titleBase(s) {
  return stripFeaturing(s)
    .replace(/\s*[([{][^)\]}]*[)\]}]/g, '')
    .replace(/\s*[-–—]\s*.+$/g, '')
    .trim();
}

function extractEditionMarkers(s) {
  const text = String(s || '');
  const found = new Set();
  const re = new RegExp(EDITION_RE.source, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    found.add(normText(m[1]));
  }
  return found;
}

function editionConflict(sourceTitle, candidateTitle) {
  const sourceMarks = extractEditionMarkers(sourceTitle);
  const candMarks = extractEditionMarkers(candidateTitle);
  for (const mark of candMarks) {
    if (!sourceMarks.has(mark)) return true;
  }
  return false;
}

function isValidTrackUri(uri) {
  return typeof uri === 'string' && SPOTIFY_TRACK_URI_RE.test(uri);
}

function normalizeTrackIdentity(source = {}) {
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const artist = typeof source.artist === 'string' ? source.artist.trim() : '';
  const identity =
    typeof source.identity === 'string' && source.identity.trim()
      ? source.identity.trim()
      : source.song_id
        ? `harmonix:${source.song_id}`
        : null;
  return {
    identity,
    title,
    artist,
    title_norm: normText(titleBase(title)),
    artists_norm: splitArtists(artist),
    duration_ms: Number.isFinite(source.duration_ms) ? Number(source.duration_ms) : null,
    isrc: typeof source.isrc === 'string' && source.isrc.trim() ? source.isrc.trim().toUpperCase() : null,
    explicit: typeof source.explicit === 'boolean' ? source.explicit : null,
  };
}

function candidateArtistsNorm(candidate) {
  if (Array.isArray(candidate.artists)) {
    return candidate.artists.map((a) => normText(a)).filter(Boolean);
  }
  if (Array.isArray(candidate.artists_objects)) {
    return candidate.artists_objects.map((a) => normText(a && a.name)).filter(Boolean);
  }
  return [];
}

function scoreCandidate(sourceNorm, candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { score: -1, hard_reject: 'null_item' };
  }
  if (candidate.is_local === true) {
    return { score: -1, hard_reject: 'local_track' };
  }
  if (candidate.is_playable === false) {
    return { score: -1, hard_reject: 'unavailable' };
  }
  if (!isValidTrackUri(candidate.uri)) {
    return { score: -1, hard_reject: 'invalid_uri' };
  }
  if (editionConflict(sourceNorm.title, candidate.name || '')) {
    return { score: -1, hard_reject: 'edition_conflict' };
  }

  const candTitleNorm = normText(titleBase(candidate.name || ''));
  const candArtists = candidateArtistsNorm(candidate);
  const candDuration = Number.isFinite(candidate.duration_ms) ? Number(candidate.duration_ms) : null;
  const candIsrc =
    typeof candidate.isrc === 'string' && candidate.isrc.trim()
      ? candidate.isrc.trim().toUpperCase()
      : null;

  let score = 0;
  let titleExact = false;
  let artistsComplete = false;

  // Title
  if (sourceNorm.title_norm && candTitleNorm) {
    if (sourceNorm.title_norm === candTitleNorm) {
      score += 40;
      titleExact = true;
    } else if (
      candTitleNorm.includes(sourceNorm.title_norm) ||
      sourceNorm.title_norm.includes(candTitleNorm)
    ) {
      score += 22;
    } else {
      const st = new Set(sourceNorm.title_norm.split(' ').filter((t) => t.length > 1));
      const ct = new Set(candTitleNorm.split(' ').filter((t) => t.length > 1));
      let overlap = 0;
      for (const t of st) if (ct.has(t)) overlap += 1;
      if (overlap >= 2) score += 14;
      else if (overlap === 1) score += 6;
    }
  }

  // Artists — require coverage of source artists when present
  if (sourceNorm.artists_norm.length && candArtists.length) {
    let covered = 0;
    for (const a of sourceNorm.artists_norm) {
      if (candArtists.some((c) => c === a || c.includes(a) || a.includes(c))) covered += 1;
    }
    const ratio = covered / sourceNorm.artists_norm.length;
    if (ratio >= 1) {
      score += 40;
      artistsComplete = true;
    } else if (ratio >= 0.5) score += 22;
    else if (covered > 0) score += 10;
  }

  // Duration: hard conflict only when title+artist already identify the work.
  if (
    sourceNorm.duration_ms != null &&
    candDuration != null &&
    titleExact &&
    artistsComplete &&
    Math.abs(sourceNorm.duration_ms - candDuration) > DURATION_HARD_MS
  ) {
    return { score: -1, hard_reject: 'duration_conflict' };
  }

  // ISRC
  if (sourceNorm.isrc && candIsrc) {
    if (sourceNorm.isrc === candIsrc) score += 25;
    else score -= 20;
  }

  // Duration closeness / soft penalty
  if (sourceNorm.duration_ms != null && candDuration != null) {
    const diff = Math.abs(sourceNorm.duration_ms - candDuration);
    if (diff <= 2000) score += 10;
    else if (diff <= 5000) score += 5;
    else if (diff > DURATION_HARD_MS) score -= 25;
  }

  // Explicit preference (soft)
  if (typeof sourceNorm.explicit === 'boolean' && typeof candidate.explicit === 'boolean') {
    if (sourceNorm.explicit === candidate.explicit) score += 8;
    else score -= 12;
  }

  // Never use popularity
  return { score, hard_reject: null };
}

function rankCandidates(source, candidates, _opts = {}) {
  const sourceNorm = normalizeTrackIdentity(source);
  const list = Array.isArray(candidates) ? candidates.filter((c) => c != null) : [];
  const ranked = list
    .map((c) => {
      const { score, hard_reject } = scoreCandidate(sourceNorm, c);
      return {
        id: c.id,
        uri: c.uri,
        name: c.name,
        artists: Array.isArray(c.artists) ? c.artists : candidateArtistsNorm(c),
        duration_ms: c.duration_ms,
        isrc: c.isrc || null,
        explicit: c.explicit,
        is_local: c.is_local,
        is_playable: c.is_playable,
        linked_from: c.linked_from || null,
        score,
        hard_reject,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Deterministic tie-break by id only for ranking display — selectMatch still rejects ties.
      return String(a.id || '').localeCompare(String(b.id || ''));
    })
    .slice(0, SEARCH_LIMIT);
  return ranked;
}

function scoreMatchCandidates(source, candidates, opts) {
  return rankCandidates(source, candidates, opts);
}

function selectMatch(source, candidates, opts = {}) {
  const sourceNorm = normalizeTrackIdentity(source);
  if (!sourceNorm.title) {
    return { outcome: 'reject', reason: 'missing_title', spotify_id: null, score: null };
  }
  if (!sourceNorm.artist) {
    return { outcome: 'reject', reason: 'missing_artist', spotify_id: null, score: null };
  }

  const ranked = rankCandidates(source, candidates, opts);
  const viable = ranked.filter((c) => !c.hard_reject && c.score >= ACCEPT_SCORE);

  if (viable.length === 0) {
    const hard = ranked.find((c) => c.hard_reject);
    if (hard) {
      return {
        outcome: 'reject',
        reason: hard.hard_reject,
        spotify_id: null,
        score: null,
      };
    }
    return { outcome: 'reject', reason: 'weak_candidate', spotify_id: null, score: null };
  }

  const top = viable[0];
  const second = viable[1];
  if (second && Math.abs(top.score - second.score) <= TIE_EPSILON) {
    return { outcome: 'reject', reason: 'ambiguous_tie', spotify_id: null, score: top.score };
  }

  return {
    outcome: 'accept',
    reason: null,
    spotify_id: top.id,
    spotify_uri: top.uri,
    score: top.score,
    matched_title: top.name,
    matched_artists: Array.isArray(top.artists) ? top.artists.join(', ') : '',
    matched_isrc: top.isrc || null,
    matched_duration_ms: top.duration_ms != null ? Number(top.duration_ms) : null,
  };
}

function buildSearchQuery(source) {
  const norm = normalizeTrackIdentity(source);
  const title = titleBase(norm.title) || norm.title;
  const artist = stripFeaturing(norm.artist) || norm.artist;
  return `track:${title} artist:${artist}`.trim();
}

function readCachedEvidence(songId) {
  return db
    .prepare(
      `SELECT song_id, spotify_source_identity, spotify_market, spotify_uri, spotify_track_id,
              spotify_matched_title, spotify_matched_artists, spotify_matched_isrc,
              spotify_matched_duration_ms, spotify_match_score, spotify_match_reason,
              spotify_matched_at, spotify_expires_at, spotify_match_key_version
       FROM song_cache WHERE song_id = ?`
    )
    .get(songId);
}

function writeCachedEvidence(songId, evidence) {
  db.prepare(
    `INSERT INTO song_cache (
       song_id, spotify_source_identity, spotify_market, spotify_uri, spotify_track_id,
       spotify_matched_title, spotify_matched_artists, spotify_matched_isrc,
       spotify_matched_duration_ms, spotify_match_score, spotify_match_reason,
       spotify_matched_at, spotify_expires_at, spotify_match_key_version, cached_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(song_id) DO UPDATE SET
       spotify_source_identity = excluded.spotify_source_identity,
       spotify_market = excluded.spotify_market,
       spotify_uri = excluded.spotify_uri,
       spotify_track_id = excluded.spotify_track_id,
       spotify_matched_title = excluded.spotify_matched_title,
       spotify_matched_artists = excluded.spotify_matched_artists,
       spotify_matched_isrc = excluded.spotify_matched_isrc,
       spotify_matched_duration_ms = excluded.spotify_matched_duration_ms,
       spotify_match_score = excluded.spotify_match_score,
       spotify_match_reason = excluded.spotify_match_reason,
       spotify_matched_at = excluded.spotify_matched_at,
       spotify_expires_at = excluded.spotify_expires_at,
       spotify_match_key_version = excluded.spotify_match_key_version`
  ).run(
    songId,
    evidence.source_identity,
    evidence.market,
    evidence.uri,
    evidence.track_id,
    evidence.matched_title,
    evidence.matched_artists,
    evidence.matched_isrc,
    evidence.matched_duration_ms,
    evidence.score,
    evidence.reason,
    evidence.matched_at,
    evidence.expires_at,
    evidence.key_version
  );
}

function clearSpotifyMatchEvidence(songId = null) {
  const sql = songId
    ? `UPDATE song_cache SET
         spotify_source_identity = NULL, spotify_market = NULL, spotify_uri = NULL,
         spotify_track_id = NULL, spotify_matched_title = NULL, spotify_matched_artists = NULL,
         spotify_matched_isrc = NULL, spotify_matched_duration_ms = NULL,
         spotify_match_score = NULL, spotify_match_reason = NULL,
         spotify_matched_at = NULL, spotify_expires_at = NULL,
         spotify_match_key_version = NULL
       WHERE song_id = ?`
    : `UPDATE song_cache SET
         spotify_source_identity = NULL, spotify_market = NULL, spotify_uri = NULL,
         spotify_track_id = NULL, spotify_matched_title = NULL, spotify_matched_artists = NULL,
         spotify_matched_isrc = NULL, spotify_matched_duration_ms = NULL,
         spotify_match_score = NULL, spotify_match_reason = NULL,
         spotify_matched_at = NULL, spotify_expires_at = NULL,
         spotify_match_key_version = NULL
       WHERE spotify_uri IS NOT NULL OR spotify_track_id IS NOT NULL`;
  if (songId) db.prepare(sql).run(songId);
  else db.prepare(sql).run();
}

function mapSpotifyTrack(item) {
  if (!item || typeof item !== 'object') return null;
  const artists = Array.isArray(item.artists)
    ? item.artists.map((a) => (a && a.name) || '').filter(Boolean)
    : [];
  const isrc = item.external_ids && item.external_ids.isrc ? item.external_ids.isrc : null;
  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    artists,
    duration_ms: item.duration_ms,
    is_local: item.is_local === true,
    is_playable: item.is_playable !== false,
    explicit: item.explicit === true,
    popularity: item.popularity,
    isrc,
    linked_from: item.linked_from || null,
  };
}

async function revalidateCachedUri(spotifyClient, userId, trackId, market) {
  if (!spotifyClient || typeof spotifyClient.spotifyRequest !== 'function') {
    return null;
  }
  const path = `/tracks/${encodeURIComponent(trackId)}?market=${encodeURIComponent(market || 'from_token')}`;
  try {
    const data = await spotifyClient.spotifyRequest(userId, path);
    return mapSpotifyTrack(data);
  } catch {
    return null;
  }
}

/**
 * Resolve a source song to a Spotify track: cache → revalidate → search → score.
 * Never sends Spotify content to NIM / AI.
 */
async function resolveSpotifyMatch(userId, source, opts = {}) {
  const market = opts.market || 'from_token';
  const now = opts.now ? opts.now() : new Date();
  const spotifyClient = opts.spotifyClient || require('./spotifyService');
  const sourceNorm = normalizeTrackIdentity(source);
  const songId =
    source.song_id ||
    (sourceNorm.identity && sourceNorm.identity.startsWith('harmonix:')
      ? sourceNorm.identity.slice('harmonix:'.length)
      : null);

  if (!sourceNorm.title) {
    return { outcome: 'reject', reason: 'missing_title', from_cache: false };
  }
  if (!sourceNorm.artist) {
    return { outcome: 'reject', reason: 'missing_artist', from_cache: false };
  }

  const policy = parseCachePolicy();
  if (songId) {
    const cached = readCachedEvidence(songId);
    if (
      cached &&
      cached.spotify_uri &&
      cached.spotify_source_identity === sourceNorm.identity &&
      cached.spotify_match_key_version === MATCH_KEY_VERSION
    ) {
      const expiresAt = cached.spotify_expires_at ? new Date(cached.spotify_expires_at).getTime() : 0;
      const sameMarket = cached.spotify_market === market;
      const fresh = expiresAt > now.getTime();

      if (sameMarket && fresh) {
        return {
          outcome: 'accept',
          reason: null,
          spotify_id: cached.spotify_track_id,
          spotify_uri: cached.spotify_uri,
          score: cached.spotify_match_score,
          from_cache: true,
          cached: true,
        };
      }

      // Cross-market or expired: revalidate URI availability for current market.
      if (cached.spotify_track_id && policy.revalidateOnExport) {
        const relinked = await revalidateCachedUri(
          spotifyClient,
          userId,
          cached.spotify_track_id,
          market
        );
        if (relinked && relinked.is_playable !== false && isValidTrackUri(relinked.uri)) {
          const evidence = {
            source_identity: sourceNorm.identity,
            market,
            uri: relinked.uri,
            track_id: relinked.id,
            matched_title: relinked.name,
            matched_artists: relinked.artists.join(', '),
            matched_isrc: relinked.isrc,
            matched_duration_ms: relinked.duration_ms,
            score: cached.spotify_match_score,
            reason: 'revalidated',
            matched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + policy.ttlMs).toISOString(),
            key_version: MATCH_KEY_VERSION,
          };
          writeCachedEvidence(songId, evidence);
          return {
            outcome: 'accept',
            reason: null,
            spotify_id: relinked.id,
            spotify_uri: relinked.uri,
            score: cached.spotify_match_score,
            from_cache: true,
            revalidated: true,
            cached: true,
          };
        }
      }
    }
  }

  const query = buildSearchQuery(source);
  const searchOpts = { limit: SEARCH_LIMIT, market: market === 'from_token' ? 'from_token' : market };
  let items = [];
  if (typeof spotifyClient.searchTracks === 'function') {
    items = await spotifyClient.searchTracks(userId, query, searchOpts);
  } else if (typeof spotifyClient.spotifyRequest === 'function') {
    const q = encodeURIComponent(query);
    const data = await spotifyClient.spotifyRequest(
      userId,
      `/search?type=track&limit=${SEARCH_LIMIT}&market=${encodeURIComponent(searchOpts.market)}&q=${q}`
    );
    items = Array.isArray(data?.tracks?.items) ? data.tracks.items : [];
  }
  const candidates = items.slice(0, SEARCH_LIMIT).map(mapSpotifyTrack);
  const selected = selectMatch(source, candidates, { market });

  if (selected.outcome === 'accept' && songId) {
    writeCachedEvidence(songId, {
      source_identity: sourceNorm.identity,
      market,
      uri: selected.spotify_uri,
      track_id: selected.spotify_id,
      matched_title: selected.matched_title,
      matched_artists: selected.matched_artists,
      matched_isrc: selected.matched_isrc,
      matched_duration_ms: selected.matched_duration_ms,
      score: selected.score,
      reason: 'matched',
      matched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + policy.ttlMs).toISOString(),
      key_version: MATCH_KEY_VERSION,
    });
  }

  return { ...selected, from_cache: false, cached: false };
}

module.exports = {
  SEARCH_LIMIT,
  ACCEPT_SCORE,
  MATCH_TTL_MS,
  MATCH_KEY_VERSION,
  normalizeTrackIdentity,
  rankCandidates,
  scoreMatchCandidates,
  selectMatch,
  buildSearchQuery,
  resolveSpotifyMatch,
  readCachedEvidence,
  writeCachedEvidence,
  clearSpotifyMatchEvidence,
  parseCachePolicy,
  mapSpotifyTrack,
  isValidTrackUri,
  normText,
  titleBase,
};
