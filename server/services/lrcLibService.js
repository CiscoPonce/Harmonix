const { normText } = require('./deezerService');

const LRCLIB_TIMEOUT_MS = process.env.LRCLIB_TIMEOUT_MS
  ? parseInt(process.env.LRCLIB_TIMEOUT_MS, 10)
  : 12_000;

const GATEWAY_ERRORS = new Set([502, 503, 504]);

function formatLrcTimestamp(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${min}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function plainToSynced(plainLyrics, durationSec = 180) {
  const lines = String(plainLyrics || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  const intervalMs = Math.max(3000, Math.floor((durationSec * 1000) / lines.length));
  return lines
    .map((text, i) => `[${formatLrcTimestamp(i * intervalMs)}] ${text}`)
    .join('\n');
}

function scoreLrcRecord(record, artist, title, duration) {
  let score = 0;
  const wantArtist = normText(artist);
  const wantTitle = normText(title);
  const gotArtist = normText(record.artistName || record.artist_name);
  const gotTitle = normText(record.trackName || record.track_name);

  if (gotArtist && wantArtist) {
    if (gotArtist === wantArtist) score += 3;
    else if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist)) score += 2;
  }
  if (gotTitle && wantTitle) {
    if (gotTitle === wantTitle) score += 3;
    else if (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle)) score += 2;
  }
  if (record.syncedLyrics) score += 2;
  else if (record.plainLyrics) score += 1;
  if (duration && record.duration) {
    const diff = Math.abs(record.duration - duration);
    if (diff <= 2) score += 2;
    else if (diff <= 8) score += 1;
  }
  return score;
}

function normalizeLyricsPayload(data, durationSec) {
  if (!data) return null;
  const plain = data.plainLyrics || null;
  let synced = data.syncedLyrics || null;
  if (!synced && plain) {
    synced = plainToSynced(plain, durationSec);
  }
  if (!synced) return null;
  return { syncedLyrics: synced, plainLyrics: plain };
}

function isGatewayStatus(status) {
  return GATEWAY_ERRORS.has(status);
}

async function fetchWithTimeout(url, fetchImpl = fetch, timeoutMs = LRCLIB_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('lrclib_timeout');
      timeoutErr.code = 'lrclib_timeout';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function lrclibGet(artist, title, duration, fetchImpl = fetch) {
  const url = new URL('https://lrclib.net/api/get');
  url.searchParams.append('artist_name', artist);
  url.searchParams.append('track_name', title);
  if (duration) url.searchParams.append('duration', String(duration));

  const res = await fetchWithTimeout(url.toString(), fetchImpl);
  if (res.status === 404) return null;
  if (isGatewayStatus(res.status)) return { __gatewayError: res.status };
  if (!res.ok) throw new Error(`lrclib_http_${res.status}`);
  return res.json();
}

async function lrclibSearch(artist, title, duration, fetchImpl = fetch) {
  const url = new URL('https://lrclib.net/api/search');
  url.searchParams.append('track_name', title);
  if (artist) url.searchParams.append('artist_name', artist);

  let res;
  try {
    res = await fetchWithTimeout(url.toString(), fetchImpl);
  } catch (err) {
    if (err.code === 'lrclib_timeout') return null;
    throw err;
  }

  if (isGatewayStatus(res.status) || !res.ok) return null;
  const results = await res.json();
  if (!Array.isArray(results) || !results.length) return null;

  const ranked = results
    .map((record) => ({ record, score: scoreLrcRecord(record, artist, title, duration) }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.record || null;
}

async function fetchLyricsForTrack(artist, title, duration, fetchImpl = fetch) {
  const strategies = [
    () => lrclibGet(artist, title, duration, fetchImpl),
    () => lrclibSearch(artist, title, duration, fetchImpl),
    () => lrclibGet(artist, title, null, fetchImpl),
  ];

  let sawGatewayError = false;

  for (const strategy of strategies) {
    try {
      const raw = await strategy();
      if (raw?.__gatewayError) {
        sawGatewayError = true;
        continue;
      }
      const normalized = normalizeLyricsPayload(raw, duration);
      if (normalized) return normalized;
    } catch (err) {
      if (err.code === 'lrclib_timeout') {
        sawGatewayError = true;
        continue;
      }
      if (String(err.message || '').startsWith('lrclib_http_')) {
        sawGatewayError = true;
        continue;
      }
    }
  }

  if (sawGatewayError) return null;
  return null;
}

module.exports = {
  LRCLIB_TIMEOUT_MS,
  plainToSynced,
  scoreLrcRecord,
  normalizeLyricsPayload,
  fetchLyricsForTrack,
  fetchWithTimeout,
  isGatewayStatus,
};
