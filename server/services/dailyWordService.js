const db = require("../db");
const aiService = require("./aiService");
const validation = require("./validationService");
const alignment = require("../utils/alignment");

const MAX_RETRIES = 3;
const FORCE_COOLDOWN_MS = process.env.FORCE_COOLDOWN_MS ? parseInt(process.env.FORCE_COOLDOWN_MS, 10) : 90_000;
const LANGUAGE_NAMES = { es: "Spanish", en: "English", fr: "French" };

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
      preview_url: track.preview,
      duration_seconds: duration,
      preview_offset: offset,
    },
  };
}

function getCachedDailyWord(userId, date) {
  const row = db.prepare(
    "SELECT word_json FROM daily_words WHERE user_id = ? AND date = ?"
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
    ON CONFLICT(user_id, date) DO UPDATE SET
      word_json = excluded.word_json,
      generated_at = CURRENT_TIMESTAMP
  `).run(userId, date, JSON.stringify(payload));
}

function summarizeDailyWordPayload(payload) {
  if (!payload?.word?.text) return null;
  return {
    date: payload.date,
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
  const limit = Math.max(1, Math.min(parseInt(days, 10) || 7, 30));
  const rows = db.prepare(`
    SELECT date, word_json
    FROM daily_words
    WHERE user_id = ?
      AND date >= date('now', ?)
    ORDER BY date DESC
    LIMIT ?
  `).all(userId, `-${limit - 1} days`, limit);

  return rows
    .map((row) => {
      try {
        return summarizeDailyWordPayload(JSON.parse(row.word_json));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function computeDailyWordStreak(userId) {
  const dates = db.prepare(`
    SELECT date FROM daily_words WHERE user_id = ? ORDER BY date DESC
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
  const todayHasWord = !!db.prepare(
    "SELECT 1 FROM daily_words WHERE user_id = ? AND date = ?"
  ).get(userId, today);

  return {
    streak_days: computeDailyWordStreak(userId),
    total_words: totalWords,
    daily_goal: 1,
    today_words: todayHasWord ? 1 : 0,
    today_goal_met: todayHasWord,
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

async function generateDailyWord(user, { force = false, fetchImpl = fetch } = {}) {
  const date = todayDate();
  if (force) assertForceCooldown(user.id);
  if (!force) {
    const cached = getCachedDailyWord(user.id, date);
    if (cached) return cached;
  }

  const targetLanguage = user.target_language || "es";
  const languageName = LANGUAGE_NAMES[targetLanguage] || "Spanish";
  const cefrLevel = user.cefr_level || "B1";
  const genre = user.genre || "pop";
  const difficulty = user.difficulty || "medium";

  const recentWords = db.prepare(`
    SELECT json_extract(word_json, '$.word.text') as word
    FROM daily_words
    WHERE user_id = ?
    ORDER BY generated_at DESC
    LIMIT 14
  `).all(user.id).map((r) => r.word).filter(Boolean);

  let lastError = null;
  let candidates = [];
  try {
    const aiResult = await aiService.generateDailyWord({
      languageName,
      cefrLevel,
      genre,
      difficulty,
      avoidWords: recentWords,
    });
    candidates = Array.isArray(aiResult) ? aiResult : [aiResult];
  } catch (err) {
    if (err.code === 'ai_rate_limit' || err.code === 'cooldown_active') throw err;
    lastError = err.code || err.message || "generation_failed";
  }

  for (const suggestion of candidates) {
    try {
      const track = await searchDeezerTrack(suggestion.artist, suggestion.song_title, fetchImpl);
      if (!track) {
        lastError = "deezer_not_found";
        continue;
      }

      const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl);
      if (!lyricsData?.syncedLyrics) {
        lastError = "lyrics_not_found";
        continue;
      }

      const syncCheck = validation.validateSongSync({ duration: track.duration }, lyricsData.syncedLyrics);
      if (!syncCheck.valid) {
        lastError = "lyrics_validation_failed";
        continue;
      }

      const occurrence = findWordOccurrence(suggestion.target_word, lyricsData.syncedLyrics);
      if (!occurrence) {
        lastError = "word_not_in_lyrics";
        continue;
      }

      const payload = buildPayload(date, suggestion, track, lyricsData, occurrence);
      saveDailyWord(user.id, date, payload);

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

      return payload;
    } catch (err) {
      if (err.code === 'ai_rate_limit' || err.code === 'cooldown_active') throw err;
      lastError = err.code || err.message || "generation_failed";
    }
  }

  if (candidates.length <= 1) {
    const err = new Error("daily_word_generation_failed");
    err.code = lastError || "unknown";
    throw err;
  }

  const err = new Error("daily_word_generation_failed");
  err.code = lastError || "unknown";
  throw err;
}

module.exports = {
  todayDate,
  formatTimestamp,
  previewOffset,
  findWordOccurrence,
  fetchLyrics,
  searchDeezerTrack,
  getCachedDailyWord,
  saveDailyWord,
  summarizeDailyWordPayload,
  getRecentDailyWords,
  computeDailyWordStreak,
  getDailyWordStats,
  generateDailyWord,
};
