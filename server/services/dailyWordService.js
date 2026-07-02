const db = require("../db");
const aiService = require("./aiService");
const validation = require("./validationService");
const alignment = require("../utils/alignment");
const { languageNameFromCode, wordMatchesTargetLanguage, normalizeLangCode } = require("../constants/languages");
const {
  effectiveCefr,
  difficultyMatchScore,
  cefrWithinBand,
  normalizeDifficulty,
} = require("../constants/difficulty");
const wordQueue = require("./wordQueueService");
const deezer = require("./deezerService");
const lrcLib = require("./lrcLibService");

const FORCE_COOLDOWN_MS = process.env.FORCE_COOLDOWN_MS ? parseInt(process.env.FORCE_COOLDOWN_MS, 10) : 90_000;
const BATCH_AI_ATTEMPTS = 3;
const REFILL_BATCH_ROUNDS = 5;
const QUEUE_BATCH_SIZE = 5;
const USER_DELIVER_STOP_AFTER = 1;

const batchGenerationInProgress = new Set();
const batchGenerationWaiters = new Map();
const refillAbortControllers = new Map();

function abortRefill(userId) {
  const controller = refillAbortControllers.get(userId);
  if (controller) controller.abort();
}

function shuffleInPlace(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const LYRIC_STOPWORDS = new Set([
  'que', 'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'por', 'con',
  'no', 'es', 'se', 'te', 'lo', 'le', 'da', 'su', 'yo', 'tu', 'mi', 'ya', 'si',
  'bien', 'muy', 'mas', 'más', 'del', 'al', 'le', 'les', 'nos', 'me', 'fue', 'ser',
]);

function plainFromLyricsData(lyricsData) {
  if (lyricsData.plainLyrics) return lyricsData.plainLyrics;
  return validation.parseLrc(lyricsData.syncedLyrics).map((p) => p.text).join('\n');
}

function pickWordFromLyricsHeuristic(plainLyrics, difficulty, avoidWords = new Set(), langCode = "es") {
  const diff = normalizeDifficulty(difficulty);
  const minLen = diff === 'easy' ? 3 : diff === 'hard' ? 7 : 4;
  const maxLen = diff === 'easy' ? 7 : diff === 'hard' ? 24 : 12;
  const targetLen = diff === 'easy' ? 4 : diff === 'hard' ? 9 : 6;

  const lines = String(plainLyrics || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = [];
  for (const line of lines) {
    const tokens = line.match(/[\p{L}áéíóúñüÁÉÍÓÚÑÜàâäçéèêëîïôùûüãõß]+/gu) || [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (lower.length < minLen || lower.length > maxLen) continue;
      if (LYRIC_STOPWORDS.has(lower)) continue;
      if (avoidWords.has(lower)) continue;
      if (!wordMatchesTargetLanguage(token, langCode)) continue;
      candidates.push({ word: token, line });
    }
  }

  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      Math.abs(a.word.length - targetLen) - Math.abs(b.word.length - targetLen)
  );
  return candidates[0];
}

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

async function fetchLyrics(artist, title, duration, fetchImpl = fetch, trackId = null) {
  if (trackId) {
    const snapshot = db.prepare(
      "SELECT synced_lyrics, plain_lyrics FROM song_lyrics_snapshot WHERE song_id = ?"
    ).get(String(trackId));
    if (snapshot?.synced_lyrics) {
      return { syncedLyrics: snapshot.synced_lyrics, plainLyrics: snapshot.plain_lyrics || null };
    }
    const cached = validation.getCachedSong(String(trackId));
    if (cached?.lyrics?.syncedLyrics) {
      return cached.lyrics;
    }
  }
  return lrcLib.fetchLyricsForTrack(artist, title, duration, fetchImpl);
}

async function searchDeezerTrack(artist, title, fetchImpl = fetch) {
  const track = await deezer.searchTrack(artist, title, fetchImpl);
  if (!track) {
    console.warn(`deezer_not_found: no match for artist="${artist}" title="${title}"`);
  }
  return track;
}

function buildPayload(date, suggestion, track, lyricsData, occurrence, langCode = "es") {
  const duration = track.duration;
  const offset = previewOffset(duration);
  return {
    date,
    cached: false,
    language_code: normalizeLangCode(langCode),
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

async function tryValidateSongCandidate(suggestion, user, date, avoidWords, fetchImpl = fetch, seenSongIds = new Set(), { allowSongReuse = false } = {}) {
  const label = `${suggestion.artist} - ${suggestion.song_title}`;
  const langCode = normalizeLangCode(user.target_language || "es");
  try {
    const track = await searchDeezerTrack(suggestion.artist, suggestion.song_title, fetchImpl);
    if (!track) {
      console.warn(`daily word reject: deezer_not_found ${label}`);
      return { error: "deezer_not_found" };
    }

    if (!allowSongReuse && seenSongIds.has(String(track.id))) {
      console.warn(`daily word reject: song_already_used ${label}`);
      return { error: "song_already_used" };
    }

    const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl, track.id);
    if (!lyricsData?.syncedLyrics) {
      console.warn(`daily word reject: lyrics_not_found ${label}`);
      return { error: "lyrics_not_found" };
    }

    const syncCheck = validation.validateSongSync({ duration: track.duration }, lyricsData.syncedLyrics);
    if (!syncCheck.valid) {
      console.warn(`daily word reject: lyrics_validation_failed ${label} (${syncCheck.issues.join(", ")})`);
      return { error: "lyrics_validation_failed" };
    }

    const plain = plainFromLyricsData(lyricsData);
    const picked = pickWordFromLyricsHeuristic(plain, user.difficulty || "medium", avoidWords, langCode);
    if (!picked) {
      console.warn(`daily word reject: no_suitable_word ${label}`);
      return { error: "no_suitable_word" };
    }

    if (!wordMatchesTargetLanguage(picked.word, langCode)) {
      console.warn(`daily word reject: wrong_language ${label} (${picked.word} not ${langCode})`);
      return { error: "wrong_language" };
    }

    const occurrence = findWordOccurrence(picked.word, lyricsData.syncedLyrics, plain);
    if (!occurrence) {
      console.warn(`daily word reject: word_not_in_lyrics ${label} (${picked.word})`);
      return { error: "word_not_in_lyrics" };
    }

    return {
      picked,
      suggestion,
      track,
      lyricsData,
      syncCheck,
      genre: suggestion.genre || null,
      occurrence,
    };
  } catch (err) {
    if (err.code === "ai_rate_limit") throw err;
    console.warn(`daily word reject: ${err.code || err.message} ${label}`);
    return { error: err.code || err.message || "generation_failed" };
  }
}

/** @deprecated word-first path — kept for tests */
async function tryValidateSuggestion(suggestion, date, fetchImpl = fetch) {
  const label = `"${suggestion.target_word}" / ${suggestion.artist} - ${suggestion.song_title}`;
  try {
    const track = await searchDeezerTrack(suggestion.artist, suggestion.song_title, fetchImpl);
    if (!track) return { error: "deezer_not_found" };

    const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl);
    if (!lyricsData?.syncedLyrics) return { error: "lyrics_not_found" };

    const syncCheck = validation.validateSongSync({ duration: track.duration }, lyricsData.syncedLyrics);
    if (!syncCheck.valid) return { error: "lyrics_validation_failed" };

    const occurrence = findWordOccurrence(
      suggestion.target_word,
      lyricsData.syncedLyrics,
      lyricsData.plainLyrics || null
    );
    if (!occurrence) return { error: "word_not_in_lyrics" };

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

async function validateAllCandidates(candidates, date, user, fetchImpl = fetch, options = {}) {
  const stopAfter = options.stopAfter ?? candidates.length;
  const relaxSongReuse = options.relaxSongReuse === true;
  const userGenre = user.genre || "pop";
  const userDifficulty = user.difficulty || "medium";
  const history = getUserDiscoveryHistory(user.id);
  const avoidWords = new Set(history.words);
  const seenSongIds = relaxSongReuse ? new Set() : new Set(history.songIds);
  let lastError = null;

  const seenSongs = relaxSongReuse ? new Set() : new Set(history.songKeys);
  const uniqueCandidates = candidates.filter((suggestion) => {
    const key = `${String(suggestion.artist || "").toLowerCase()}|${String(suggestion.song_title || "").toLowerCase()}`;
    if (seenSongs.has(key)) return false;
    seenSongs.add(key);
    return true;
  });

  const partials = [];
  const usedWords = new Set();
  let resolveEarly = null;
  const earlyDone = new Promise((resolve) => { resolveEarly = resolve; });
  let pending = uniqueCandidates.length;

  const tasks = uniqueCandidates.map((suggestion) => (async () => {
    const result = await tryValidateSongCandidate(
      suggestion, user, date, avoidWords, fetchImpl, seenSongIds, { allowSongReuse: relaxSongReuse }
    );
    if (result.picked) {
      const key = result.picked.word.toLowerCase();
      if (!usedWords.has(key)) {
        usedWords.add(key);
        avoidWords.add(key);
        seenSongIds.add(String(result.track.id));
        partials.push(result);
        if (partials.length >= stopAfter && resolveEarly) resolveEarly();
      }
    } else if (result.error) {
      lastError = result.error;
    }
    pending -= 1;
    if (pending === 0 && resolveEarly) resolveEarly();
    return result;
  })());

  if (stopAfter < uniqueCandidates.length) {
    await Promise.race([earlyDone, Promise.all(tasks)]);
  } else {
    await Promise.all(tasks);
  }

  if (!partials.length) {
    if (pending > 0) await Promise.all(tasks);
    if (!partials.length) {
      return { valid: [], sideEffects: [], lastError, candidateCount: candidates.length };
    }
  }

  const languageName = languageNameFromCode(user.target_language || "es");
  const nativeLanguageName = languageNameFromCode(user.native_language || "en", "English");
  const glossTarget = partials.slice(0, stopAfter);
  const glosses = await glossWithCompleteness(
    glossTarget.map((p) => ({ word: p.picked.word, line: p.picked.line })),
    languageName,
    nativeLanguageName,
    { fast: stopAfter <= USER_DELIVER_STOP_AFTER }
  );

  const buildResults = (items, glossList) => items.map((p, i) => {
    const gloss = glossList[i] || { translation: null, part_of_speech: null, pronunciation: null };
    const wordSuggestion = {
      target_word: p.picked.word,
      translation: gloss.translation,
      part_of_speech: gloss.part_of_speech,
      pronunciation: gloss.pronunciation,
      difficulty: userDifficulty,
      genre: p.genre,
    };
    const payload = buildPayload(date, wordSuggestion, p.track, p.lyricsData, p.occurrence, user.target_language || "es");
    return {
      payload,
      track: p.track,
      lyricsData: p.lyricsData,
      syncCheck: p.syncCheck,
      suggestion: p.suggestion,
      genre: p.genre,
    };
  });

  const immediateResults = buildResults(glossTarget, glosses);
  immediateResults.sort((a, b) => genreBoostScore(b.genre, userGenre) - genreBoostScore(a.genre, userGenre));

  const finishBackground = async () => {
    if (pending > 0) await Promise.all(tasks);
    const extraPartials = partials.slice(glossTarget.length);
    if (!extraPartials.length) return { queued: 0 };

    const extraGlosses = await glossWithCompleteness(
      extraPartials.map((p) => ({ word: p.picked.word, line: p.picked.line })),
      languageName,
      nativeLanguageName,
      { fast: false }
    );
    const extraResults = buildResults(extraPartials, extraGlosses);
    for (const effect of extraResults) {
      persistPayloadSideEffects(effect.payload, effect.track, effect.lyricsData, effect.syncCheck);
    }
    const uniquePayloads = filterUniquePayloads(user.id, extraResults.map((r) => r.payload));
    const inserted = wordQueue.enqueuePayloads(user.id, uniquePayloads);
    console.log(`daily word background: queued ${inserted}/${uniquePayloads.length} extra words`);
    scheduleRefill(user, fetchImpl);
    return { queued: inserted };
  };

  return {
    valid: immediateResults.map((r) => r.payload),
    sideEffects: immediateResults,
    lastError,
    candidateCount: candidates.length,
    finishBackground: stopAfter < uniqueCandidates.length ? finishBackground : null,
  };
}

function getUserDiscoveryHistory(userId) {
  const words = new Set();
  const songIds = new Set();
  const songKeys = new Set();

  const ingest = (payload) => {
    if (!payload) return;
    if (payload.word?.text) words.add(String(payload.word.text).toLowerCase());
    if (payload.song?.id) songIds.add(String(payload.song.id));
    if (payload.song?.artist && payload.song?.title) {
      songKeys.add(
        `${String(payload.song.artist).toLowerCase()}|${String(payload.song.title).toLowerCase()}`
      );
    }
  };

  db.prepare(`
    SELECT word_json FROM daily_words WHERE user_id = ?
  `).all(userId).forEach((row) => {
    try { ingest(JSON.parse(row.word_json)); } catch { /* ignore */ }
  });

  for (const item of wordQueue.listReadyItems(userId)) {
    ingest(item.payload);
  }

  return { words, songIds, songKeys };
}

function filterUnusedSongCandidates(userId, candidates) {
  const history = getUserDiscoveryHistory(userId);
  return (candidates || []).filter((candidate) => {
    const key = `${String(candidate.artist || "").toLowerCase()}|${String(candidate.song_title || "").toLowerCase()}`;
    return !history.songKeys.has(key);
  });
}

function getCuratedCandidatesForBatch(userId, langCode, genre) {
  const verified = shuffleInPlace([...aiService.getVerifiedSongCandidates(langCode, genre)]);
  const all = aiService.getCuratedSongCandidates(langCode, genre);
  const fresh = filterUnusedSongCandidates(userId, all);
  const secondary = fresh.length >= 5 ? fresh : all;
  const merged = mergeCandidateLists(verified, secondary);
  return shuffleInPlace(merged);
}

function getFullSongCandidatePool(langCode, genre) {
  const verified = aiService.getVerifiedSongCandidates(langCode, genre);
  const all = aiService.getCuratedSongCandidates(langCode, genre);
  return shuffleInPlace(mergeCandidateLists(verified, all));
}

function filterUniquePayloads(userId, payloads) {
  const history = getUserDiscoveryHistory(userId);
  const seenWords = new Set(history.words);
  const unique = [];

  for (const payload of payloads || []) {
    const word = payload?.word?.text?.toLowerCase();
    if (!word) continue;
    if (seenWords.has(word)) continue;
    seenWords.add(word);
    unique.push(payload);
  }

  return unique;
}

function getAvoidWords(userId) {
  return [...getUserDiscoveryHistory(userId).words];
}

function payloadMatchesUserLanguage(payload, langCode) {
  if (!payload?.word?.text) return false;
  const expected = normalizeLangCode(langCode);
  if (payload.language_code && payload.language_code !== expected) return false;
  return wordMatchesTargetLanguage(payload.word.text, expected);
}

function getCachedDailyWord(userId, date, langCode = "es") {
  const row = db.prepare(
    `SELECT word_json FROM daily_words
     WHERE user_id = ? AND date = ?
     ORDER BY generated_at DESC, id DESC
     LIMIT 1`
  ).get(userId, date);
  if (!row) return null;
  try {
    const payload = JSON.parse(row.word_json);
    if (!payloadMatchesUserLanguage(payload, langCode)) return null;
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
  const langCode = normalizeLangCode(user.target_language || "es");
  const languageName = languageNameFromCode(langCode);
  const genre = user.genre || "pop";
  const difficulty = user.difficulty || "medium";
  const history = getUserDiscoveryHistory(user.id);
  const avoidSongs = [...history.songKeys].slice(0, 40);

  try {
    const aiResult = await aiService.generateDailyWordSongs({
      languageName,
      languageCode: langCode,
      genre,
      difficulty,
      avoidSongs,
    });
    return Array.isArray(aiResult) ? aiResult : [aiResult];
  } catch (err) {
    if (err.code === "ai_rate_limit") throw err;
    const curated = getCuratedCandidatesForBatch(user.id, langCode, genre);
    console.warn(`daily word: AI song pick failed (${err.code || err.message}), using ${curated.length} curated hits`);
    return curated.slice(0, 8);
  }
}

function mergeCandidateLists(primary, secondary) {
  const seen = new Set();
  const merged = [];
  for (const item of [...primary, ...secondary]) {
    const key = `${String(item.artist || "").toLowerCase()}|${String(item.song_title || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

async function generateValidatedBatch(user, fetchImpl = fetch, options = {}) {
  const date = todayDate();
  const langCode = normalizeLangCode(user.target_language || "es");
  const genre = user.genre || "pop";
  const stopAfter = options.stopAfter ?? QUEUE_BATCH_SIZE;

  const runOnce = async (relaxSongReuse) => {
    let merged = [];

    if (relaxSongReuse) {
      merged = getFullSongCandidatePool(langCode, genre).slice(0, 20);
      console.log(`daily word batch: retrying ${merged.length} candidates allowing new words from known songs`);
    } else {
      const curated = getCuratedCandidatesForBatch(user.id, langCode, genre).slice(0, 15);

      let candidates = [];
      try {
        candidates = await fetchAiCandidates(user);
      } catch (err) {
        if (err.code === "ai_rate_limit") throw err;
        if (!curated.length) {
          return { valid: [], sideEffects: [], lastError: err.code || err.message || "generation_failed" };
        }
      }

      merged = mergeCandidateLists(curated, candidates);
    }

    if (!merged.length) {
      return { valid: [], sideEffects: [], lastError: "invalid_ai_daily_word_response" };
    }

    return validateAllCandidates(merged, date, user, fetchImpl, {
      ...options,
      tryCuratedFirst: false,
      stopAfter,
      relaxSongReuse,
    });
  };

  let result = await runOnce(false);
  if (!result.valid.length) {
    result = await runOnce(true);
  }
  return result;
}

async function persistBatchSideEffects(sideEffects) {
  for (const effect of sideEffects) {
    persistPayloadSideEffects(effect.payload, effect.track, effect.lyricsData, effect.syncCheck);
  }
}

async function deliverFromBatch(user, batch, fetchImpl, { fromQueue = false } = {}) {
  await persistBatchSideEffects(batch.sideEffects);
  const [first, ...rest] = batch.valid;
  if (rest.length) {
    const uniqueRest = filterUniquePayloads(user.id, rest);
    const inserted = wordQueue.enqueuePayloads(user.id, uniqueRest);
    if (uniqueRest.length < rest.length) {
      console.log(`daily word batch: skipped ${rest.length - uniqueRest.length} duplicate queued words`);
    }
    console.log(`daily word batch: delivered 1, queued ${inserted}/${uniqueRest.length} (${batch.valid.length}/${batch.candidateCount} validated)`);
  } else {
    console.log(`daily word batch: delivered 1 (${batch.valid.length}/${batch.candidateCount} validated)`);
  }
  if (batch.finishBackground) {
    setImmediate(() => {
      batch.finishBackground().catch((err) => {
        console.warn(`daily word background failed for ${user.id}:`, err.message || err);
      }).finally(() => scheduleRefill(user, fetchImpl));
    });
  } else {
    scheduleRefill(user, fetchImpl);
  }
  return deliverPayload(user.id, first, { fromQueue });
}

async function withUserBatchLock(userId, fn) {
  abortRefill(userId);

  if (batchGenerationWaiters.has(userId)) {
    return batchGenerationWaiters.get(userId);
  }

  const run = (async () => {
    batchGenerationInProgress.add(userId);
    try {
      return await fn();
    } finally {
      batchGenerationInProgress.delete(userId);
      batchGenerationWaiters.delete(userId);
    }
  })();

  batchGenerationWaiters.set(userId, run);
  return run;
}

async function generateAndDeliverBatch(user, fetchImpl = fetch, { maxAttempts = 2, maxMs = 75000 } = {}) {
  return withUserBatchLock(user.id, async () => {
    const started = Date.now();
    const deadline = started + maxMs;
    let lastError = "unknown";

    for (let attempt = 0; attempt < maxAttempts && Date.now() < deadline; attempt++) {
      const batch = await generateValidatedBatch(user, fetchImpl, { stopAfter: USER_DELIVER_STOP_AFTER });
      if (batch.valid.length) {
        console.log(`daily word batch: first valid in ${Date.now() - started}ms (attempt ${attempt + 1})`);
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
  });
}

async function refillQueue(user, fetchImpl = fetch) {
  if (batchGenerationInProgress.has(user.id)) return;

  const abort = new AbortController();
  refillAbortControllers.set(user.id, abort);

  try {
    let emptyRounds = 0;

    while (
      !abort.signal.aborted &&
      !batchGenerationInProgress.has(user.id) &&
      wordQueue.countReady(user.id) < wordQueue.QUEUE_MAX &&
      emptyRounds < REFILL_BATCH_ROUNDS
    ) {
      const needed = wordQueue.QUEUE_MAX - wordQueue.countReady(user.id);
      const batch = await generateValidatedBatch(user, fetchImpl, { stopAfter: needed });
      if (abort.signal.aborted || batchGenerationInProgress.has(user.id)) break;

      if (!batch.valid.length) {
        emptyRounds += 1;
        console.warn(
          `queue refill round ${emptyRounds}/${REFILL_BATCH_ROUNDS}: 0/${batch.candidateCount || 5} valid (${batch.lastError})`
        );
        continue;
      }

      emptyRounds = 0;
      await persistBatchSideEffects(batch.sideEffects);
      const uniqueValid = filterUniquePayloads(user.id, batch.valid);
      const inserted = wordQueue.enqueuePayloads(user.id, uniqueValid);
      const ready = wordQueue.countReady(user.id);
      console.log(`queue refill: +${inserted} (${uniqueValid.length}/${batch.valid.length} validated) ready=${ready}/${wordQueue.QUEUE_MAX}`);
      if (batch.finishBackground) {
        await batch.finishBackground();
      }
      if (!inserted) break;
    }

    if (
      wordQueue.countReady(user.id) === 0 &&
      emptyRounds >= REFILL_BATCH_ROUNDS &&
      !batchGenerationInProgress.has(user.id)
    ) {
      const err = new Error("queue_refill_failed");
      err.code = "generation_failed";
      throw err;
    }
  } finally {
    refillAbortControllers.delete(user.id);
  }
}

function scheduleRefill(user, fetchImpl = fetch) {
  if (process.env.NODE_ENV === "test") return;
  setImmediate(async () => {
    if (wordQueue.countReady(user.id) >= wordQueue.QUEUE_MAX) return;
    try {
      await refillQueue(user, fetchImpl);
    } catch (err) {
      console.warn(`queue refill failed for ${user.id}:`, err.message || err);
    }
    backfillQueueMetadata(user).catch((err) => {
      console.warn(`queue metadata backfill failed for ${user.id}:`, err.message || err);
    });
  });
}

async function consumeNextDailyWord(user, fetchImpl = fetch) {
  const langCode = normalizeLangCode(user.target_language || "es");
  const maxSkips = wordQueue.QUEUE_MAX + 5;

  for (let i = 0; i < maxSkips; i++) {
    const queued = wordQueue.consumeNext(user.id);
    if (!queued) return null;

    if (!payloadMatchesUserLanguage(queued, langCode)) {
      console.warn(`daily word skip: wrong language for "${queued.word?.text}" (want ${langCode})`);
      continue;
    }

    const history = getUserDiscoveryHistory(user.id);
    const word = String(queued.word?.text || "").toLowerCase();
    if (word && history.words.has(word)) {
      console.warn(`daily word skip: duplicate queued word "${queued.word?.text}"`);
      continue;
    }

    const delivered = deliverPayload(user.id, queued, { fromQueue: true });
    scheduleRefill(user, fetchImpl);
    return delivered;
  }

  return null;
}

async function generateNextDailyWord(user, fetchImpl = fetch) {
  const instant = await consumeNextDailyWord(user, fetchImpl);
  if (instant) return enrichIfNeeded(instant, user);
  return enrichIfNeeded(await generateAndDeliverBatch(user, fetchImpl), user);
}

function hydratePayloadAudio(payload) {
  if (!payload?.song?.id) return payload;
  if (!payload.audio) payload.audio = {};
  payload.audio.preview_url = deezer.previewProxyPath(String(payload.song.id));
  return payload;
}

function translationNeedsFix(word) {
  if (!word?.text) return false;
  const translation = String(word.translation || "").trim();
  return !translation || translation.toLowerCase() === word.text.toLowerCase();
}

function wordMetaNeedsEnrichment(word) {
  return translationNeedsFix(word) || !word?.pronunciation;
}

async function glossWithCompleteness(items, languageName, nativeLanguageName, { fast = false } = {}) {
  if (!items?.length) return [];
  let glosses = await aiService.glossDailyWords(items, languageName, { fast, nativeLanguageName });
  const incomplete = items.some((item, i) => wordMetaNeedsEnrichment({
    text: item.word,
    translation: glosses[i]?.translation,
    pronunciation: glosses[i]?.pronunciation,
  }));
  if (!incomplete) return glosses;
  glosses = await aiService.glossDailyWords(items, languageName, { fast: false, nativeLanguageName });
  return glosses;
}

async function enrichPayloadWordMeta(payload, user) {
  const text = payload?.word?.text;
  const line = payload?.lyric?.snippet;
  if (!text || !line || !wordMetaNeedsEnrichment(payload.word)) return payload;

  const languageName = languageNameFromCode(user.target_language || "es");
  const nativeLanguageName = languageNameFromCode(user.native_language || "en", "English");
  const item = [{ word: text, line }];
  const started = Date.now();

  try {
    let glosses = await aiService.glossDailyWords(item, languageName, { fast: true, nativeLanguageName });
    let gloss = glosses[0];
    if (translationNeedsFix({
      text,
      translation: gloss?.translation ?? payload.word.translation,
    })) {
      glosses = await aiService.glossDailyWords(item, languageName, { fast: false, nativeLanguageName });
      gloss = glosses[0];
    }
    if (!gloss) return payload;
    console.log(`daily word enrich gloss: ${text} in ${Date.now() - started}ms`);
    return {
      ...payload,
      word: {
        ...payload.word,
        translation: gloss.translation ?? payload.word.translation,
        part_of_speech: gloss.part_of_speech ?? payload.word.part_of_speech,
        pronunciation: gloss.pronunciation ?? payload.word.pronunciation,
      },
    };
  } catch (err) {
    console.warn(`daily word enrich gloss failed in ${Date.now() - started}ms: ${err.message || err}`);
    return payload;
  }
}

async function backfillQueueMetadata(user) {
  if (process.env.NODE_ENV === "test") return { updated: 0 };
  const items = wordQueue.listReadyItems(user.id);
  let updated = 0;
  for (const item of items) {
    if (!wordMetaNeedsEnrichment(item.payload?.word)) continue;
    const enriched = await enrichPayloadWordMeta(item.payload, user);
    if (JSON.stringify(enriched) !== JSON.stringify(item.payload)) {
      wordQueue.updatePayload(item.id, enriched);
      updated += 1;
    }
  }
  if (updated > 0) {
    console.log(`queue metadata backfill: updated ${updated} queued words for ${user.id}`);
  }
  return { updated };
}

async function enrichIfNeeded(payload, user) {
  if (process.env.NODE_ENV === "test") return hydratePayloadAudio(payload);
  const hydrated = hydratePayloadAudio(payload);
  if (!wordMetaNeedsEnrichment(hydrated.word)) return hydrated;

  const enriched = await enrichPayloadWordMeta(hydrated, user);
  const w = enriched.word || {};
  const prev = hydrated.word || {};
  const changed = w.translation !== prev.translation
    || w.pronunciation !== prev.pronunciation
    || w.part_of_speech !== prev.part_of_speech;
  if (changed && user?.id) {
    saveDailyWord(user.id, enriched.date || todayDate(), enriched);
  }
  return enriched;
}

async function generateDailyWord(user, { force = false, fetchImpl = fetch } = {}) {
  const date = todayDate();

  if (!force) {
    const cached = getCachedDailyWord(user.id, date, user.target_language || "es");
    if (cached) {
      scheduleRefill(user, fetchImpl);
      return enrichIfNeeded(cached, user);
    }
  }

  const instant = await consumeNextDailyWord(user, fetchImpl);
  if (instant) return enrichIfNeeded(instant, user);

  if (force) assertForceCooldown(user.id);

  return enrichIfNeeded(await generateAndDeliverBatch(user, fetchImpl), user);
}

module.exports = {
  todayDate,
  formatTimestamp,
  previewOffset,
  findWordOccurrence,
  fetchLyrics,
  searchDeezerTrack,
  buildPayload,
  pickWordFromLyricsHeuristic,
  tryValidateSongCandidate,
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
  enrichPayloadWordMeta,
  enrichIfNeeded,
  translationNeedsFix,
  wordMetaNeedsEnrichment,
  backfillQueueMetadata,
  glossWithCompleteness,
  getUserDiscoveryHistory,
  filterUniquePayloads,
  filterUnusedSongCandidates,
};
