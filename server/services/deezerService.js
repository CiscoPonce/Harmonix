const DEEZER_TRACK_URL = 'https://api.deezer.com/track';
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search';

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
    return await fetchImpl(url, { signal: controller.signal });
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
  return data.data || [];
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

  if (!candidates.length) return null;

  const ranked = candidates
    .map((track) => ({ track, score: scoreTrackMatch(track, artist, title) }))
    .filter(({ track, score }) => track.preview && score >= 2)
    .sort((a, b) => b.score - a.score || (b.track.rank || 0) - (a.track.rank || 0));

  return ranked[0]?.track || null;
}

async function fetchTrack(trackId, fetchImpl = fetch) {
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

/** Same-origin path; browser audio tag cannot send JWT headers. */
function previewProxyPath(trackId) {
  return `/api/audio/preview/${trackId}`;
}

module.exports = {
  normText,
  stripFeaturing,
  titleBase,
  scoreTrackMatch,
  buildSearchQueries,
  searchTrack,
  searchTracks,
  fetchTrack,
  previewProxyPath,
};
