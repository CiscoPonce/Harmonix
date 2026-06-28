const db = require("../db");
const aiService = require("./aiService");
const validation = require("./validationService");
const alignment = require("../utils/alignment");
const { languageNameFromCode } = require("../constants/languages");
const {
  effectiveCefr,
  difficultyMatchScore,
  cefrWithinBand,
} = require("../constants/difficulty");
const wordQueue = require("./wordQueueService");
const deezer = require("./deezerService");
const lrcLib = require("./lrcLibService");

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

function findWordOccurrence(word, syncedLyrics, plainLyrics = null) {
  const parsed = validation.parseLrc(syncedLyrics);
  if (!parsed.length) return null;

  const syncLines = parsed.map((p) => ({ text: p.text }));
  let occurrences = alignment.mapVocabToLyrics([{ id: "daily", word }], syncLines);

  if (!occurrences.length && plainLyrics) {
    const plainLines = plainLyrics
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
    const plainOcc = alignment.mapVocabToLyrics([{ id: "daily", word }], plainLines);
    if (plainOcc.length) {
      const idx = Math.min(plainOcc[0].line_index, parsed.length - 1);
      const onSyncLine = alignment.mapVocabToLyrics([{ id: "daily", word }], [syncLines[idx]].filter((l) => l.text));
      if (onSyncLine.length) {
        occurrences = [{ ...onSyncLine[0], line_index: idx }];
      } else {
        occurrences = [{ line_index: idx, char_start: plainOcc[0].char_start, char_end: plainOcc[0].char_end }];
      }
    }
  }

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
  return lrcLib.fetchLyricsForTrack(artist, title, duration, fetchImpl);
}

async function searchDeezerTrack(artist, title, fetchImpl = fetch) {
  const track = await deezer.searchTrack(artist, title, fetchImpl);
  if (!track) {
    console.warn(`deezer_not_found: no match for artist="${artist}" title="${title}"`);
  }
  return track;
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
      cefr_level: suggestion.cefr_level || null,
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
  const label = `"${suggestion.target_word}" / ${suggestion.artist} - ${suggestion.song_title}`;
  try {
    const track = await searchDeezerTrack(suggestion.artist, suggestion.song_title, fetchImpl);
    if (!track) return { error: "deezer_not_found" };

    const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl);
    if (!lyricsData?.syncedLyrics) {
      console.warn(`daily word reject: lyrics_not_found ${label}`);
      return { error: "lyrics_not_found" };
    }

    const syncCheck = validation.validateSongSync({ duration: track.duration }, lyricsData.syncedLyrics);
    if (!syncCheck.valid) {
      console.warn(`daily word reject: lyrics_validation_failed ${label} (${syncCheck.issues.join(', ')})`);
      return { error: "lyrics_validation_failed" };
    }

    const occurrence = findWordOccurrence(
      suggestion.target_word,
      lyricsData.syncedLyrics,
      lyricsData.plainLyrics || null
    );
    if (!occurrence) {
      console.warn(`daily word reject: word_not_in_lyrics ${label}`);
      return { error: "word_not_in_lyrics" };
    }

    const payload = buildPayload(date, suggestion, track, lyricsData, occurrence);
    return { payload, track, lyricsData, syncCheck, genre: suggestion.genre || null };
  } catch (err) {
    if (err.code === "ai_rate_limit") throw err;
    console.warn(`daily word reject: ${err.code || err.message} ${label}`);
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

function candidateRankScore(suggestion, userGenre, userDifficulty, effectiveLevel) {
  let score = genreBoostScore(suggestion.genre, userGenre);
  score += difficultyMatchScore(suggestion.difficulty, userDifficulty);
  if (suggestion.cefr_level && effectiveLevel) {
    if (cefrWithinBand(suggestion.cefr_level, effectiveLevel, userDifficulty)) score += +2;
    else score -= 1;
  }
  return score;
}

async function validateAllCandidates(candidates, date, userGenre, userDifficulty = "medium", userCefr = "B1", fetchImpl = fetch) {
  const effectiveLevel = effectiveCefr(userCefr, userDifficulty);
  let lastError = null;

  const outcomes = await Promise.all(
    candidates.map(async (suggestion) => {
      const result = await tryValidateSuggestion(suggestion, date, fetchImpl);
      return { suggestion, result };
    })
  );

  const results = [];
  for (const { suggestion, result } of outcomes) {
    if (result.payload) {
      results.push({ ...result, suggestion });
    } else if (result.error) {
      lastError = result.error;
    }
  }

  results.sort((a, b) => {
    const rankA = candidateRankScore(a.suggestion, userGenre, userDifficulty, effectiveLevel);
    const rankB = candidateRankScore(b.suggestion, userGenre, userDifficulty, effectiveLevel);
    return rankB - rankA;
  });

  return {
    valid: results.map((r) => r.payload),
    sideEffects: results,
    lastError,
    candidateCount: candidates.length,
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
  const difficulty = user.difficulty || "medium";
  const aiResult = await aiService.generateDailyWord({
    languageName,
    cefrLevel: effectiveCefr(user.cefr_level || "B1", difficulty),
    genre: user.genre || "pop",
    difficulty,
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

  return validateAllCandidates(
    candidates,
    date,
    user.genre || "pop",
    user.difficulty || "medium",
    user.cefr_level || "B1",
    fetchImpl
  );
}

const BATCH_AI_ATTEMPTS = 2;
const REFILL_BATCH_ROUNDS = 3;

async function persistBatchSideEffects(sideEffects) {
  for (const effect of sideEffects) {
    persistPayloadSideEffects(effect.payload, effect.track, effect.lyricsData, effect.syncCheck);
  }
}

async function deliverFromBatch(user, batch, fetchImpl, { fromQueue = false } = {}) {
  await persistBatchSideEffects(batch.sideEffects);
  const [first, ...rest] = batch.valid;
  if (rest.length) {
    const inserted = wordQueue.enqueuePayloads(user.id, rest);
    console.log(`daily word batch: delivered 1, queued ${inserted}/${rest.length} (${batch.valid.length}/${batch.candidateCount} validated)`);
  } else {
    console.log(`daily word batch: delivered 1 (${batch.valid.length}/${batch.candidateCount} validated)`);
  }
  scheduleRefill(user, fetchImpl);
  return deliverPayload(user.id, first, { fromQueue });
}

async function generateAndDeliverBatch(user, fetchImpl = fetch, { maxAttempts = BATCH_AI_ATTEMPTS } = {}) {
  let lastError = "unknown";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const batch = await generateValidatedBatch(user, fetchImpl);
    if (batch.valid.length) {
      return deliverFromBatch(user, batch, fetchImpl);
    }
    lastError = batch.lastError || "unknown";
    console.warn(
      `daily word batch attempt ${attempt + 1}/${maxAttempts}: 0/${batch.candidateCount || 5} passed (${lastError})`
    );
  }

  const err = new Error("daily_word_generation_failed");
  err.code = lastError;
  throw err;
}

async function refillQueue(user, fetchImpl = fetch) {
  let emptyRounds = 0;

  while (wordQueue.countReady(user.id) < wordQueue.QUEUE_MAX && emptyRounds < REFILL_BATCH_ROUNDS) {
    const batch = await generateValidatedBatch(user, fetchImpl);
    if (!batch.valid.length) {
      emptyRounds += 1;
      console.warn(
        `queue refill round ${emptyRounds}/${REFILL_BATCH_ROUNDS}: 0/${batch.candidateCount || 5} valid (${batch.lastError})`
      );
      continue;
    }

    emptyRounds = 0;
    await persistBatchSideEffects(batch.sideEffects);
    const inserted = wordQueue.enqueuePayloads(user.id, batch.valid);
    const ready = wordQueue.countReady(user.id);
    console.log(`queue refill: +${inserted} (${batch.valid.length} validated) ready=${ready}/${wordQueue.QUEUE_MAX}`);
    if (!inserted) break;
  }

  if (wordQueue.countReady(user.id) === 0 && emptyRounds >= REFILL_BATCH_ROUNDS) {
    const err = new Error("queue_refill_failed");
    err.code = "generation_failed";
    throw err;
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

async function generateNextDailyWord(user, fetchImpl = fetch) {
  const instant = await consumeNextDailyWord(user, fetchImpl);
  if (instant) return hydratePayloadAudio(instant);
  return hydratePayloadAudio(await generateAndDeliverBatch(user, fetchImpl));
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
  }

  const instant = await consumeNextDailyWord(user, fetchImpl);
  if (instant) return hydratePayloadAudio(instant);

  if (force) assertForceCooldown(user.id);

  return hydratePayloadAudio(await generateAndDeliverBatch(user, fetchImpl));
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
  generateNextDailyWord,
  generateAndDeliverBatch,
  generateDailyWord,
  hydratePayloadAudio,
};
