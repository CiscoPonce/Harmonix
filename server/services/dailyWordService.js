const db = require("../db");
const aiService = require("./aiService");
const validation = require("./validationService");
const alignment = require("../utils/alignment");
const { languageNameFromCode } = require("../constants/languages");
const wordQueue = require("./wordQueueService");
const deezer = require("./deezerService");

const MAX_RETRIES = 3;
const FORCE_COOLDOWN_MS = process.env.FORCE_COOLDOWN_MS ? parseInt(process.env.FORCE_COOLDOWN_MS, 10) : 90_000;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatTimestamp(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function previewOffset(duration) {
  if (duration > 60) return 30;
  if (duration > 30) return duration - 30;
  return 0;
}

function parseLyricLines(lrc) {
  if (!lrc) return [];
  return lrc
    .split("\n")
    .map((line) => {
      const stripped = line.replace(/^\s*\[\d{1,2}:\d{1,2}(?:\.\d+)?\]\s*/, "").trim();
      return stripped ? { text: stripped } : null;
    })
    .filter(Boolean);
}

function findWordOccurrence(word, syncedLyrics) {
  const parsed = validation.parseLrc(syncedLyrics);
  if (!parsed.length) return null;

  const plainLines = parsed.map((p) => ({ text: p.text }));
  const occurrences = alignment.mapVocabToLyrics([{ id: "daily", word }], plainLines);
  if (!occurrences.length) return null;

  const hit = occurrences[0];
  const line = parsed[hit.line_index];
  if (!line) return null;

  return {
    snippet: line.text,
    timestamp: formatTimestamp(line.time),
    timestamp_ms: line.time,
    line_index: hit.line_index,
    char_start: hit.char_start,
    char_end: hit.char_end,
  };
}

async function fetchLyrics(artist, title, duration, fetchImpl = fetch) {
  const url = new URL("https://lrclib.net/api/get");
  url.searchParams.append("artist_name", artist);
  url.searchParams.append("track_name", title);
  if (duration) url.searchParams.append("duration", String(duration));

  const res = await fetchImpl(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib_http_${res.status}`);
  const data = await res.json();
  if (!data.syncedLyrics) return null;
  return data;
}

async function searchDeezerTrack(artist, title, fetchImpl = fetch) {
  const q = encodeURIComponent(`${artist} ${title}`);
  const res = await fetchImpl(`https://api.deezer.com/search?q=${q}&limit=10`);
  if (!res.ok) throw new Error(`deezer_http_${res.status}`);
  const data = await res.json();
  const tracks = data.data || [];
  if (!tracks.length) return null;

  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s]/g, "").trim();
  const wantArtist = norm(artist);
  const wantTitle = norm(title);

  const ranked = tracks
    .map((t) => {
      let score = 0;
      if (norm(t.artist?.name).includes(wantArtist) || wantArtist.includes(norm(t.artist?.name))) score += 2;
      if (norm(t.title).includes(wantTitle) || wantTitle.includes(norm(t.title))) score += 2;
      if (t.preview) score += 1;
      return { track: t, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 2 || !best.track.preview) return null;
  return best.track;
}

function buildPayload(date, suggestion, track, lyricsData, occurrence) {
  const duration = track.duration;
  const offset = previewOffset(duration);
  return {
    date,
    cached: false,
    word: {
      text: suggestion.target_word,
      translation: suggestion.translation,
      part_of_speech: suggestion.part_of_speech || null,
      pronunciation: suggestion.pronunciation || null,
      difficulty: suggestion.difficulty || "medium",
    },
    lyric: occurrence,
    song: {
      id: String(track.id),
      title: track.title,
      artist: track.artist.name,
      genre: suggestion.genre || null,
    },
    audio: {
      preview_url: deezer.previewProxyPath(String(track.id)),
      duration_seconds: duration,
      preview_offset: offset,
    },
  };
}

function persistPayloadSideEffects(payload, track, lyricsData, syncCheck) {
  validation.cacheSongData(String(track.id), lyricsData, {
    id: track.id,
    title: track.title,
    artist: track.artist.name,
    preview: track.preview,
    duration: track.duration,
    preview_offset: previewOffset(track.duration),
  });
  validation.recordValidation(String(track.id), track.artist.name, track.title, track.duration, syncCheck);

  db.prepare(`
    INSERT INTO song_lyrics_snapshot (song_id, synced_lyrics, plain_lyrics)
    VALUES (?, ?, ?)
    ON CONFLICT(song_id) DO UPDATE SET
      synced_lyrics = excluded.synced_lyrics,
      plain_lyrics = excluded.plain_lyrics,
      fetched_at = CURRENT_TIMESTAMP
  `).run(String(track.id), lyricsData.syncedLyrics, lyricsData.plainLyrics || null);
}

async function tryValidateSuggestion(suggestion, date, fetchImpl = fetch) {
  try {
    const track = await searchDeezerTrack(suggestion.artist, suggestion.song_title, fetchImpl);
    if (!track) return { error: "deezer_not_found" };

    const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl);
    if (!lyricsData?.syncedLyrics) return { error: "lyrics_not_found" };

    const syncCheck = validation.validateSongSync({ duration: track.duration }, lyricsData.syncedLyrics);
    if (!syncCheck.valid) return { error: "lyrics_validation_failed" };

    const occurrence = findWordOccurrence(suggestion.target_word, lyricsData.syncedLyrics);
    if (!occurrence) return { error: "word_not_in_lyrics" };

    const payload = buildPayload(date, suggestion, track, lyricsData, occurrence);
    return { payload, track, lyricsData, syncCheck, genre: suggestion.genre || null };
  } catch (err) {
    if (err.code === "ai_rate_limit") throw err;
    return { error: err.code || err.message || "generation_failed" };
  }
}

function genreBoostScore(genre, userGenre) {
  if (!genre || !userGenre || userGenre === "any") return 0;
  const g = String(genre).toLowerCase();
  const u = String(userGenre).toLowerCase();
  if (g.includes(u) || u.includes(g)) return 2;
  return 0;
}

async function validateAllCandidates(candidates, date, userGenre, fetchImpl = fetch) {
  const results = [];
  let lastError = null;

  for (const suggestion of candidates) {
    const result = await tryValidateSuggestion(suggestion, date, fetchImpl);
    if (result.payload) {
      results.push(result);
    } else if (result.error) {
      lastError = result.error;
    }
  }

  results.sort((a, b) => genreBoostScore(b.genre, userGenre) - genreBoostScore(a.genre, userGenre));

  return {
    valid: results.map((r) => r.payload),
    sideEffects: results,
    lastError,
  };
}

function getAvoidWords(userId) {
  const history = db.prepare(`
    SELECT json_extract(word_json, '$.word.text') as word
    FROM daily_words
    WHERE user_id = ?
    ORDER BY generated_at DESC
    LIMIT 14
  `).all(userId).map((r) => r.word).filter(Boolean);

  const queued = wordQueue.getQueuedWordTexts(userId);
  return [...new Set([...history, ...queued])];
}

function getCachedDailyWord(userId, date) {
  const row = db.prepare(
    `SELECT word_json FROM daily_words
     WHERE user_id = ? AND date = ?
     ORDER BY generated_at DESC, id DESC
     LIMIT 1`
  ).get(userId, date);
  if (!row) return null;
  try {
    const payload = JSON.parse(row.word_json);
    return { ...payload, cached: true };
  } catch {
    return null;
  }
}

function saveDailyWord(userId, date, payload) {
  db.prepare(`
    INSERT INTO daily_words (user_id, date, word_json, generated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(userId, date, JSON.stringify(payload));
}

function deliverPayload(userId, payload, { fromQueue = false } = {}) {
  const date = todayDate();
  const delivered = { ...payload, date, cached: false, from_queue: fromQueue };
  saveDailyWord(userId, date, delivered);
  return delivered;
}

function summarizeDailyWordPayload(payload, meta = {}) {
  if (!payload?.word?.text) return null;
  return {
    id: meta.id ?? null,
    date: payload.date,
    discovered_at: meta.generated_at ?? null,
    word: {
      text: payload.word.text,
      translation: payload.word.translation || null,
    },
    song: payload.song
      ? {
          id: payload.song.id,
          title: payload.song.title,
          artist: payload.song.artist,
        }
      : null,
  };
}

function getRecentDailyWords(userId, days = 7) {
  const dayWindow = Math.max(1, Math.min(parseInt(days, 10) || 7, 30));
  const maxEntries = 50;
  const rows = db.prepare(`
    SELECT id, date, word_json, generated_at
    FROM daily_words
    WHERE user_id = ?
      AND date >= date('now', ?)
    ORDER BY generated_at DESC
    LIMIT ?
  `).all(userId, `-${dayWindow - 1} days`, maxEntries);

  return rows
    .map((row) => {
      try {
        return summarizeDailyWordPayload(JSON.parse(row.word_json), {
          id: row.id,
          generated_at: row.generated_at,
        });
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function computeDailyWordStreak(userId) {
  const dates = db.prepare(`
    SELECT DISTINCT date FROM daily_words WHERE user_id = ? ORDER BY date DESC
  `).all(userId).map((row) => row.date);

  if (!dates.length) return 0;

  const dateSet = new Set(dates);
  const cursor = new Date();
  const today = todayDate();

  if (!dateSet.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getDailyWordStats(userId) {
  const today = todayDate();
  const totalWords = db.prepare(
    "SELECT COUNT(*) as count FROM daily_words WHERE user_id = ?"
  ).get(userId).count;
  const todayWords = db.prepare(
    "SELECT COUNT(*) as count FROM daily_words WHERE user_id = ? AND date = ?"
  ).get(userId, today).count;

  return {
    streak_days: computeDailyWordStreak(userId),
    total_words: totalWords,
    daily_goal: 1,
    today_words: todayWords,
    today_goal_met: todayWords >= 1,
  };
}

function assertForceCooldown(userId) {
  const row = db.prepare(
    "SELECT generated_at FROM daily_words WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1"
  ).get(userId);
  if (!row?.generated_at) return;
  const elapsed = Date.now() - new Date(row.generated_at + "Z").getTime();
  if (elapsed < FORCE_COOLDOWN_MS) {
    const waitSec = Math.ceil((FORCE_COOLDOWN_MS - elapsed) / 1000);
    const err = new Error("cooldown_active");
    err.code = "cooldown_active";
    err.retryAfterSec = waitSec;
    throw err;
  }
}

async function fetchAiCandidates(user) {
  const languageName = languageNameFromCode(user.target_language || "es");
  const aiResult = await aiService.generateDailyWord({
    languageName,
    cefrLevel: user.cefr_level || "B1",
    genre: user.genre || "pop",
    difficulty: user.difficulty || "medium",
    avoidWords: getAvoidWords(user.id),
  });
  return Array.isArray(aiResult) ? aiResult : [aiResult];
}

async function generateValidatedBatch(user, fetchImpl = fetch) {
  const date = todayDate();
  let candidates = [];
  try {
    candidates = await fetchAiCandidates(user);
  } catch (err) {
    if (err.code === "ai_rate_limit") throw err;
    return { valid: [], sideEffects: [], lastError: err.code || err.message || "generation_failed" };
  }

  if (!candidates.length) {
    return { valid: [], sideEffects: [], lastError: "invalid_ai_daily_word_response" };
  }

  return validateAllCandidates(candidates, date, user.genre || "pop", fetchImpl);
}

async function refillQueue(user, fetchImpl = fetch) {
  while (wordQueue.countReady(user.id) < wordQueue.QUEUE_MAX) {
    const { valid, sideEffects, lastError } = await generateValidatedBatch(user, fetchImpl);
    if (!valid.length) {
      const err = new Error("queue_refill_failed");
      err.code = lastError || "unknown";
      throw err;
    }

    for (const effect of sideEffects) {
      persistPayloadSideEffects(effect.payload, effect.track, effect.lyricsData, effect.syncCheck);
    }

    const inserted = wordQueue.enqueuePayloads(user.id, valid);
    if (!inserted) break;
    if (wordQueue.countReady(user.id) >= wordQueue.REFILL_THRESHOLD) break;
  }
}

function scheduleRefill(user, fetchImpl = fetch) {
  if (process.env.NODE_ENV === "test") return;
  wordQueue.triggerRefillIfNeeded(user, (u) => refillQueue(u, fetchImpl));
}

async function consumeNextDailyWord(user, fetchImpl = fetch) {
  const queued = wordQueue.consumeNext(user.id);
  if (!queued) return null;

  const delivered = deliverPayload(user.id, queued, { fromQueue: true });
  scheduleRefill(user, fetchImpl);
  return delivered;
}

function hydratePayloadAudio(payload) {
  if (!payload?.song?.id) return payload;
  if (!payload.audio) payload.audio = {};
  payload.audio.preview_url = deezer.previewProxyPath(String(payload.song.id));
  return payload;
}

async function generateDailyWord(user, { force = false, fetchImpl = fetch } = {}) {
  const date = todayDate();

  if (!force) {
    const cached = getCachedDailyWord(user.id, date);
    if (cached) {
      scheduleRefill(user, fetchImpl);
      return hydratePayloadAudio(cached);
    }

    const instant = await consumeNextDailyWord(user, fetchImpl);
    if (instant) return hydratePayloadAudio(instant);
  } else {
    const instant = await consumeNextDailyWord(user, fetchImpl);
    if (instant) return hydratePayloadAudio(instant);
    assertForceCooldown(user.id);
  }

  const { valid, sideEffects, lastError } = await generateValidatedBatch(user, fetchImpl);
  if (!valid.length) {
    const err = new Error("daily_word_generation_failed");
    err.code = lastError || "unknown";
    throw err;
  }

  for (const effect of sideEffects) {
    persistPayloadSideEffects(effect.payload, effect.track, effect.lyricsData, effect.syncCheck);
  }

  const [first, ...rest] = valid;
  const delivered = deliverPayload(user.id, first, { fromQueue: false });
  wordQueue.enqueuePayloads(user.id, rest);
  scheduleRefill(user, fetchImpl);
  return hydratePayloadAudio(delivered);
}

module.exports = {
  todayDate,
  formatTimestamp,
  previewOffset,
  findWordOccurrence,
  fetchLyrics,
  searchDeezerTrack,
  buildPayload,
  tryValidateSuggestion,
  validateAllCandidates,
  getCachedDailyWord,
  saveDailyWord,
  deliverPayload,
  summarizeDailyWordPayload,
  getRecentDailyWords,
  computeDailyWordStreak,
  getDailyWordStats,
  generateValidatedBatch,
  refillQueue,
  consumeNextDailyWord,
  generateDailyWord,
  hydratePayloadAudio,
};
