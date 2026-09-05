const DEEZER_TRACK_URL = 'https://api.deezer.com/track';
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search';
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

// Some cloud egress IPs get Akamai 403 without a browser-like User-Agent.
const DEEZER_HEADERS = {
  'User-Agent':
    process.env.DEEZER_USER_AGENT
    || 'Mozilla/5.0 (compatible; Harmonix/1.7; +https://harmonix.app)',
  Accept: 'application/json',
};

const PREVIEW_STREAM_HEADERS = {
  'User-Agent':
    process.env.DEEZER_USER_AGENT
    || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'audio/*,*/*;q=0.9',
};

const ITUNES_ID_PREFIX = 'itunes_';

function isItunesTrackId(trackId) {
  return String(trackId || '').startsWith(ITUNES_ID_PREFIX);
}

function itunesTrackIdFromParam(trackId) {
  const raw = String(trackId || '');
  if (!raw.startsWith(ITUNES_ID_PREFIX)) return null;
  const n = Number(raw.slice(ITUNES_ID_PREFIX.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalize Apple Search/Lookup result into Deezer-shaped track for the rest of the app. */
function mapItunesResult(result) {
  if (!result?.trackId || !result.previewUrl) return null;
  const artwork = result.artworkUrl100
    ? String(result.artworkUrl100).replace('100x100bb', '300x300bb')
    : null;
  return {
    id: `${ITUNES_ID_PREFIX}${result.trackId}`,
    title: result.trackName || result.collectionName || 'Unknown',
    duration: Math.round((result.trackTimeMillis || 0) / 1000) || 30,
    preview: result.previewUrl,
    rank: result.trackCount || 0,
    provider: 'itunes',
    artist: { name: result.artistName || 'Unknown' },
    album: {
      cover: artwork,
      cover_medium: artwork,
      cover_big: artwork,
    },
  };
}

function normText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFeaturing(s) {
  return String(s || '')
    .replace(/\s*[\(\[](feat\.?|ft\.?|featuring)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*/gi, '')
    .trim();
}

function titleBase(s) {
  return stripFeaturing(s)
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '')
    .replace(/\s*-\s*(remix|live|acoustic|version|edit).*$/i, '')
    .trim();
}

function tokenSet(s) {
  return new Set(normText(s).split(' ').filter((t) => t.length > 1));
}

function tokenOverlap(a, b) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  return overlap;
}

function scoreTrackMatch(track, artist, title) {
  const trackArtist = normText(track.artist?.name);
  const trackTitle = normText(track.title);
  const wantArtist = normText(stripFeaturing(artist));
  const wantTitle = normText(titleBase(title));

  let score = 0;

  if (trackArtist && wantArtist) {
    if (trackArtist === wantArtist) score += 4;
    else if (trackArtist.includes(wantArtist) || wantArtist.includes(trackArtist)) score += 3;
    else if (tokenOverlap(trackArtist, wantArtist) > 0) score += 2;
  }

  if (trackTitle && wantTitle) {
    if (trackTitle === wantTitle) score += 4;
    else if (trackTitle.includes(wantTitle) || wantTitle.includes(trackTitle)) score += 3;
    else if (tokenOverlap(trackTitle, wantTitle) >= 2) score += 2;
    else if (tokenOverlap(trackTitle, wantTitle) === 1) score += 1;
  }

  if (track.preview) score += 1;
  if (typeof track.rank === 'number' && track.rank > 100000) score += 1;

  return score;
}

function buildSearchQueries(artist, title) {
  const cleanArtist = stripFeaturing(artist);
  const cleanTitle = titleBase(title);
  const queries = [
    `${cleanArtist} ${cleanTitle}`,
    cleanTitle,
    `${cleanArtist} ${cleanTitle.split(' ').slice(0, 4).join(' ')}`,
    cleanArtist,
  ];
  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
}

const DEEZER_TIMEOUT_MS = process.env.DEEZER_TIMEOUT_MS
  ? parseInt(process.env.DEEZER_TIMEOUT_MS, 10)
  : 5_000;

async function fetchWithTimeout(url, fetchImpl = fetch, timeoutMs = DEEZER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal, headers: DEEZER_HEADERS });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('deezer_timeout');
      timeoutErr.code = 'deezer_timeout';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function searchTracks(query, fetchImpl = fetch, limit = 15) {
  const url = `${DEEZER_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetchWithTimeout(url, fetchImpl);
  if (!res.ok) throw new Error(`deezer_http_${res.status}`);
  const data = await res.json();
  if (data && data.error) throw new Error(`deezer_api_${data.error.code || 'error'}`);
  // Akamai sometimes returns HTML bodies with a 200 — reject non-arrays.
  if (!Array.isArray(data?.data)) throw new Error('deezer_bad_payload');
  return data.data;
}

async function searchCatalog(query, fetchImpl = fetch, limit = 15) {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const tracks = await searchTracks(q, fetchImpl, limit);
    if (Array.isArray(tracks) && tracks.length) return tracks;
  } catch (err) {
    console.warn(`deezer catalog search failed (${err.message}) — iTunes fallback`);
  }
  try {
    return await searchItunesTracks(q, fetchImpl, limit);
  } catch (err) {
    console.warn(`itunes catalog search failed (${err.message})`);
    return [];
  }
}

async function searchItunesTracks(query, fetchImpl = fetch, limit = 15) {
  const url =
    `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(query)}`
    + `&media=music&entity=song&limit=${limit}`;
  const res = await fetchWithTimeout(url, fetchImpl);
  if (!res.ok) throw new Error(`itunes_http_${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.results)) throw new Error('itunes_bad_payload');
  return data.results.map(mapItunesResult).filter(Boolean);
}

async function searchItunesTrack(artist, title, fetchImpl = fetch) {
  const queries = buildSearchQueries(artist, title);
  const seen = new Set();
  const candidates = [];

  for (const query of queries) {
    let tracks;
    try {
      tracks = await searchItunesTracks(query, fetchImpl);
    } catch {
      continue;
    }
    for (const track of tracks) {
      if (!track?.id || seen.has(track.id)) continue;
      seen.add(track.id);
      candidates.push(track);
    }
  }

  if (!candidates.length) return null;

  const ranked = candidates
    .map((track) => ({ track, score: scoreTrackMatch(track, artist, title) }))
    .filter(({ track, score }) => track.preview && score >= 2)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.track || null;
}

async function searchTrack(artist, title, fetchImpl = fetch) {
  const queries = buildSearchQueries(artist, title);
  const seen = new Set();
  const candidates = [];

  for (const query of queries) {
    let tracks;
    try {
      tracks = await searchTracks(query, fetchImpl);
    } catch {
      continue;
    }
    for (const track of tracks) {
      if (!track?.id || seen.has(track.id)) continue;
      seen.add(track.id);
      candidates.push(track);
    }
  }

  if (candidates.length) {
    const ranked = candidates
      .map((track) => ({ track, score: scoreTrackMatch(track, artist, title) }))
      .filter(({ track, score }) => track.preview && score >= 2)
      .sort((a, b) => b.score - a.score || (b.track.rank || 0) - (a.track.rank || 0));

    if (ranked[0]?.track) return ranked[0].track;
  }

  // Deezer often geo-blocks cloud IPs (Akamai 403). Apple iTunes previews remain reachable.
  return searchItunesTrack(artist, title, fetchImpl);
}

async function fetchItunesTrack(trackId, fetchImpl = fetch) {
  const itunesId = itunesTrackIdFromParam(trackId);
  if (!itunesId) {
    const err = new Error('track_not_found');
    err.code = 'track_not_found';
    throw err;
  }
  const res = await fetchWithTimeout(`${ITUNES_LOOKUP_URL}?id=${itunesId}`, fetchImpl);
  if (!res.ok) {
    const err = new Error('track_not_found');
    err.code = 'track_not_found';
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const mapped = mapItunesResult(data?.results?.[0]);
  if (!mapped?.preview) {
    const err = new Error('no_preview');
    err.code = 'no_preview';
    throw err;
  }
  return mapped;
}

async function fetchTrack(trackId, fetchImpl = fetch) {
  if (isItunesTrackId(trackId)) {
    return fetchItunesTrack(trackId, fetchImpl);
  }

  const res = await fetchWithTimeout(`${DEEZER_TRACK_URL}/${trackId}`, fetchImpl);
  if (!res.ok) {
    const err = new Error('track_not_found');
    err.code = 'track_not_found';
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message || 'track_not_found');
    err.code = 'track_not_found';
    throw err;
  }
  if (!data.preview) {
    const err = new Error('no_preview');
    err.code = 'no_preview';
    throw err;
  }
  return data;
}

/**
 * Resolve a streamable preview URL for a track id.
 * Falls back to song_cache preview, then iTunes search by artist/title.
 */
async function resolvePreviewForTrackId(trackId, { artist, title, cachedPreview } = {}, fetchImpl = fetch) {
  try {
    const track = await fetchTrack(trackId, fetchImpl);
    if (track?.preview) return { previewUrl: track.preview, track };
  } catch {
    /* try fallbacks */
  }

  if (cachedPreview && typeof cachedPreview === 'string' && cachedPreview.startsWith('http')) {
    return { previewUrl: cachedPreview, track: null };
  }

  if (artist && title) {
    const itunes = await searchItunesTrack(artist, title, fetchImpl);
    if (itunes?.preview) return { previewUrl: itunes.preview, track: itunes };
  }

  const err = new Error('no_preview');
  err.code = 'no_preview';
  throw err;
}

/** Prefer medium Deezer album art; fall back to larger/smaller variants. */
function coverFromDeezerTrack(track) {
  if (!track || typeof track !== 'object') return null;
  const album = track.album || {};
  const url =
    album.cover_medium ||
    album.cover_big ||
    album.cover ||
    album.cover_small ||
    album.cover_xl ||
    null;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

function extractCoverFromCachedTrack(trackOrJson) {
  if (trackOrJson == null) return null;
  let track = trackOrJson;
  if (typeof trackOrJson === 'string') {
    try {
      track = JSON.parse(trackOrJson);
    } catch {
      return null;
    }
  }
  if (!track || typeof track !== 'object') return null;
  const direct =
    track.cover ||
    track.cover_medium ||
    track.artwork_url ||
    track.album?.cover_medium ||
    track.album?.cover ||
    null;
  return typeof direct === 'string' && direct.trim() ? direct.trim() : null;
}

/** Same-origin path; browser audio tag cannot send JWT headers. */
function previewProxyPath(trackId, artist, title) {
  const base = `/api/audio/preview/${encodeURIComponent(String(trackId))}`;
  const params = new URLSearchParams();
  if (artist) params.set('artist', String(artist));
  if (title) params.set('title', String(title));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

module.exports = {
  normText,
  stripFeaturing,
  titleBase,
  scoreTrackMatch,
  buildSearchQueries,
  searchTrack,
  searchTracks,
  searchCatalog,
  searchItunesTracks,
  searchItunesTrack,
  fetchTrack,
  fetchItunesTrack,
  resolvePreviewForTrackId,
  isItunesTrackId,
  coverFromDeezerTrack,
  extractCoverFromCachedTrack,
  previewProxyPath,
  PREVIEW_STREAM_HEADERS,
  ITUNES_ID_PREFIX,
};
