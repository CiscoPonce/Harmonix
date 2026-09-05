const db = require("../db");
const aiService = require("./aiService");
const validation = require("./validationService");
const alignment = require("../utils/alignment");
const { languageNameFromCode, wordMatchesTargetLanguage, lyricsMatchTargetLanguage, normalizeLangCode, getLyricStopwords } = require("../constants/languages");
const {
  effectiveCefr,
  difficultyMatchScore,
  cefrWithinBand,
  normalizeDifficulty,
} = require("../constants/difficulty");
const wordQueue = require("./wordQueueService");
const deezer = require("./deezerService");
const lrcLib = require("./lrcLibService");
const spotifyProfileService = require("./spotifyProfileService");

const FORCE_COOLDOWN_MS = process.env.FORCE_COOLDOWN_MS
  ? parseInt(process.env.FORCE_COOLDOWN_MS, 10)
  : 0; // Unlimited refresh by default; set FORCE_COOLDOWN_MS to throttle if needed.
const BATCH_AI_ATTEMPTS = 3;
const REFILL_BATCH_ROUNDS = 5;
const QUEUE_BATCH_SIZE = 5;
const USER_DELIVER_STOP_AFTER = 1;

const batchGenerationInProgress = new Set();
const batchGenerationWaiters = new Map();
const refillAbortControllers = new Map();
/** Bumped when language/genre preferences change so in-flight batches cannot deliver stale style. */
const preferenceEpochByUser = new Map();

function abortRefill(userId) {
  const controller = refillAbortControllers.get(userId);
  if (controller) controller.abort();
}

function bumpPreferenceEpoch(userId) {
  preferenceEpochByUser.set(userId, (preferenceEpochByUser.get(userId) || 0) + 1);
}

function currentPreferenceEpoch(userId) {
  return preferenceEpochByUser.get(userId) || 0;
}

function shuffleInPlace(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function plainFromLyricsData(lyricsData) {
  if (lyricsData.plainLyrics) return lyricsData.plainLyrics;
  return validation.parseLrc(lyricsData.syncedLyrics).map((p) => p.text).join('\n');
}

function pickWordFromLyricsHeuristic(plainLyrics, difficulty, avoidWords = new Set(), langCode = "es", options = {}) {
  const diff = normalizeDifficulty(difficulty);
  const minLen = diff === 'easy' ? 3 : diff === 'hard' ? 7 : 4;
  const maxLen = diff === 'easy' ? 7 : diff === 'hard' ? 24 : 12;
  const targetLen = diff === 'easy' ? 4 : diff === 'hard' ? 9 : 6;
  const stopwords = getLyricStopwords(langCode);
  const songTitle = String(options.songTitle || '');
  const artist = String(options.artist || '');
  const tokenizeName = (value) => new Set(
    (String(value).match(/[\p{L}áéíóúñüÁÉÍÓÚÑÜàâäçéèêëîïôùûüãõßàèéìòù]+/gu) || [])
      .map((t) => t.toLowerCase())
      .filter((t) => t.length >= 3 && !stopwords.has(t))
  );
  const titleTokens = tokenizeName(songTitle);
  const artistTokens = tokenizeName(artist);

  const lines = String(plainLyrics || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const freq = new Map();
  for (const line of lines) {
    const tokens = line.match(/[\p{L}áéíóúñüÁÉÍÓÚÑÜàâäçéèêëîïôùûüãõßàèéìòù]+/gu) || [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      freq.set(lower, (freq.get(lower) || 0) + 1);
    }
  }

  const candidates = [];
  for (const line of lines) {
    const tokens = line.match(/[\p{L}áéíóúñüÁÉÍÓÚÑÜàâäçéèêëîïôùûüãõßàèéìòù]+/gu) || [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (lower.length < minLen || lower.length > maxLen) continue;
      if (stopwords.has(lower)) continue;
      if (avoidWords.has(lower)) continue;
      if (!wordMatchesTargetLanguage(token, langCode)) continue;
      // Reject pure lyric filler / onomatopoeia
      if (/^(la|na|da|pa|ra|ta|bam|bum|pum|dun|tum)+$/i.test(lower)) continue;
      if (/^(oh+|ah+|uh+|mm+|hey+|yeah+|yea+)$/i.test(lower)) continue;
      // Clipped lyric slang ("Holdin'") and artist names are not vocabulary.
      if (new RegExp(`(?:^|[^\\p{L}])${lower}'`, "iu").test(line)) continue;
      if (artistTokens.has(lower)) continue;

      let score = 0;
      // Prefer words that carry the song (title / hook repetition)
      if (titleTokens.has(lower)) score += 40;
      const count = freq.get(lower) || 1;
      if (count >= 4) score += 18;
      else if (count >= 2) score += 10;

      // Prefer language-marked tokens (Portuguese ãõç, Spanish ñ, etc.)
      if (langCode === 'pt' && /[ãõç]/i.test(token)) score += 8;
      else if (langCode === 'es' && /[ñ]/i.test(token)) score += 8;
      else if (langCode === 'de' && /[äöüß]/i.test(token)) score += 8;
      else if (langCode === 'de' && /(ung|heit|keit|lich|schaft)$/i.test(token)) score += 4;
      else if (/[àâäçéèêëîïôùûüÿœæãõñáíóúüßàèìòù]/i.test(token)) score += 3;

      // Prefer content-length near difficulty target
      score -= Math.abs(token.length - targetLen);

      candidates.push({ word: token, line, score, count });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.count - a.count);
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

function previewOffset(duration, provider = "deezer") {
  if (provider === "itunes" || String(provider).startsWith("itunes")) {
    // Apple Search previews are typically the opening ~30s.
    return 0;
  }
  if (duration > 60) return 30;
  if (duration > 30) return duration - 30;
  return 0;
}

/** Preview clip maps to [offset, offset+30) in the full track. */
function previewWindow(duration, provider = "deezer") {
  const offset = previewOffset(duration, provider);
  return { offset, end: offset + 30, length: 30 };
}

function isTimestampInPreview(timestampMs, duration, provider = "deezer") {
  const { offset, end } = previewWindow(duration, provider);
  const t = Number(timestampMs) / 1000;
  // Leave margin so a word-centered ~1s lead-in still fits.
  return t >= offset + 1.0 && t <= end - 1.5;
}

/** Opening ~30s — matches iTunes previews and Deezer short-track previews (Coolify often falls back to iTunes). */
function isTimestampInOpeningPreview(timestampMs) {
  const t = Number(timestampMs) / 1000;
  return t >= 1.0 && t <= 28.5;
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

function findWordOccurrence(word, syncedLyrics, plainLyrics = null, options = {}) {
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

  const duration = typeof options.duration === "number" ? options.duration : null;
  const provider = options.provider || "deezer";
  let chosen = occurrences[0];
  if (duration != null) {
    // Prefer hits inside the *actual* preview provider window (Deezer mid-track vs iTunes opening).
    // Do not prefer opening lines when the streamed clip is Deezer's 30–60s cut — that desyncs Hear-it.
    const inProvider = occurrences.find((hit) => {
      const line = parsed[hit.line_index];
      return line && isTimestampInPreview(line.time, duration, provider);
    });
    if (inProvider) {
      chosen = inProvider;
    }
  }

  const line = parsed[chosen.line_index];
  if (!line) return null;

  const in_preview =
    duration != null ? isTimestampInPreview(line.time, duration, provider) : null;
  const nextLine = parsed[chosen.line_index + 1];
  // Real sung-line length from next LRC stamp (fallback ~4s).
  const line_end_ms =
    nextLine && Number.isFinite(nextLine.time) && nextLine.time > line.time
      ? nextLine.time
      : line.time + 4000;

  return {
    snippet: line.text,
    timestamp: formatTimestamp(line.time),
    timestamp_ms: line.time,
    line_end_ms,
    line_index: chosen.line_index,
    char_start: chosen.char_start,
    char_end: chosen.char_end,
    in_preview,
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
  const provider = track.provider === "itunes" || deezer.isItunesTrackId?.(track.id)
    ? "itunes"
    : "deezer";
  const offset = previewOffset(duration, provider);
  const inPreview =
    typeof occurrence.in_preview === "boolean"
      ? occurrence.in_preview
      : isTimestampInPreview(occurrence.timestamp_ms, duration, provider);
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
      gloss_v: suggestion.gloss_v || null,
      line_translation: suggestion.line_translation || null,
    },
    lyric: {
      ...occurrence,
      in_preview: inPreview,
      line_translation: suggestion.line_translation || occurrence.line_translation || null,
    },
    song: {
      id: String(track.id),
      title: track.title,
      artist: track.artist.name,
      genre: suggestion.genre || null,
      cover: deezer.coverFromDeezerTrack(track),
    },
    preferred_genre: suggestion.genre || null,
    audio: {
      preview_url: deezer.previewProxyPath(String(track.id), track.artist?.name, track.title),
      duration_seconds: duration,
      preview_offset: offset,
      preview_end: offset + 30,
      preview_provider: provider,
    },
  };
}

function persistPayloadSideEffects(payload, track, lyricsData, syncCheck) {
  const provider =
    track.provider === "itunes" || deezer.isItunesTrackId?.(track.id) ? "itunes" : "deezer";
  validation.cacheSongData(String(track.id), lyricsData, {
    id: track.id,
    title: track.title,
    artist: track.artist.name,
    preview: track.preview,
    duration: track.duration,
    cover: deezer.coverFromDeezerTrack(track),
    provider,
    preview_offset: previewOffset(track.duration, provider),
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

async function tryValidateSongCandidate(suggestion, user, date, avoidWords, fetchImpl = fetch, seenSongIds = new Set(), {
  allowSongReuse = false,
  allowOutsidePreview = false,
  knownTrack = null,
} = {}) {
  const label = `${suggestion.artist} - ${suggestion.song_title}`;
  const langCode = normalizeLangCode(user.target_language || "es");
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const track = knownTrack || await searchDeezerTrack(suggestion.artist, suggestion.song_title, fetchImpl);
      if (!track) {
        lastError = "deezer_not_found";
        if (attempt === 0 && !knownTrack) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        console.warn(`daily word reject: deezer_not_found ${label}`);
        return { error: lastError };
      }

      if (!allowSongReuse && seenSongIds.has(String(track.id))) {
        console.warn(`daily word reject: song_already_used ${label}`);
        return { error: "song_already_used" };
      }

      const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl, track.id);
      if (!lyricsData?.syncedLyrics) {
        lastError = "lyrics_not_found";
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        console.warn(`daily word reject: lyrics_not_found ${label}`);
        return { error: lastError };
      }

      const syncCheck = validation.validateSongSync({ duration: track.duration }, lyricsData.syncedLyrics);
      if (!syncCheck.valid) {
        console.warn(`daily word reject: lyrics_validation_failed ${label} (${syncCheck.issues.join(", ")})`);
        return { error: "lyrics_validation_failed" };
      }

      const plain = plainFromLyricsData(lyricsData);
      if (!lyricsMatchTargetLanguage(plain, langCode)) {
        console.warn(`daily word reject: lyrics_wrong_language ${label} (want ${langCode})`);
        return { error: "lyrics_wrong_language" };
      }

      const duration = track.duration;
      const provider =
        track.provider === "itunes" || deezer.isItunesTrackId?.(track.id) ? "itunes" : "deezer";
      const { offset: previewStart, end: previewEnd } = previewWindow(duration, provider);
      const parsedLines = validation.parseLrc(lyricsData.syncedLyrics);
      const pickOpts = {
        songTitle: suggestion.song_title || track.title || "",
        artist: suggestion.artist || track.artist || "",
      };

      // Prefer a word whose lyric line sits inside the 30s preview cut —
      // and that is meaningful in the song (title/hook), not filler.
      let picked = null;
      let occurrence = null;
      const candidates = [];
      const firstPick = pickWordFromLyricsHeuristic(
        plain,
        user.difficulty || "medium",
        avoidWords,
        langCode,
        pickOpts
      );
      if (firstPick) candidates.push(firstPick);

      const previewPlain = parsedLines
        .filter((line) => isTimestampInPreview(line.time, duration, provider))
        .map((line) => line.text)
        .join("\n");
      if (previewPlain.trim()) {
        const previewPick = pickWordFromLyricsHeuristic(
          previewPlain,
          user.difficulty || "medium",
          avoidWords,
          langCode,
          pickOpts
        );
        if (previewPick && (!firstPick || previewPick.word.toLowerCase() !== firstPick.word.toLowerCase())) {
          candidates.unshift(previewPick); // prefer preview-window word
        }
      }

      for (const candidate of candidates) {
        if (!wordMatchesTargetLanguage(candidate.word, langCode)) continue;
        const occ = findWordOccurrence(candidate.word, lyricsData.syncedLyrics, plain, {
          duration,
          provider,
        });
        if (!occ) continue;
        picked = candidate;
        occurrence = occ;
        if (occ.in_preview) break;
      }

      if (!picked || !occurrence) {
        console.warn(`daily word reject: no_suitable_word ${label}`);
        return { error: "no_suitable_word" };
      }

      if (!occurrence.in_preview && !allowOutsidePreview) {
        console.warn(
          `daily word reject: lyric outside preview window ${label} ` +
            `(t=${occurrence.timestamp} window=${formatTimestamp(previewStart * 1000)}-${formatTimestamp(previewEnd * 1000)})`
        );
        return { error: "lyric_outside_preview" };
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
      lastError = err.code || err.message || "generation_failed";
      if (attempt === 0 && (err.code === "deezer_timeout" || err.code === "lrclib_timeout")) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      console.warn(`daily word reject: ${lastError} ${label}`);
      return { error: lastError };
    }
  }

  console.warn(`daily word reject: ${lastError || "generation_failed"} ${label}`);
  return { error: lastError || "generation_failed" };
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
      lyricsData.plainLyrics || null,
      { duration: track.duration }
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
  if (!userGenre || userGenre === "any") return 0;
  if (!genre) return -1;
  const g = String(genre).toLowerCase();
  const u = String(userGenre).toLowerCase();
  if (aiService.genresCompatible(g, u)) return 8;
  if (g.includes(u) || u.includes(g)) return 4;
  return -6;
}

function candidateRankScore(suggestion, userGenre, userDifficulty, effectiveLevel) {
  let score = genreBoostScore(suggestion.genre, userGenre);
  score += difficultyMatchScore(suggestion.difficulty, userDifficulty);
  if (suggestion.cefr_level && effectiveLevel) {
    if (cefrWithinBand(suggestion.cefr_level, effectiveLevel, userDifficulty)) score += 2;
    else score -= 1;
  }
  return score;
}

const VALIDATE_CONCURRENCY = process.env.VALIDATE_CONCURRENCY
  ? Math.max(1, parseInt(process.env.VALIDATE_CONCURRENCY, 10) || 3)
  : 4;

async function runValidationPool(candidates, worker, { isStopped = () => false } = {}) {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < candidates.length) {
      if (isStopped()) return;
      const index = nextIndex;
      nextIndex += 1;
      await worker(candidates[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(VALIDATE_CONCURRENCY, Math.max(candidates.length, 1)) },
    () => runWorker()
  );
  await Promise.all(workers);
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

  const effectiveLevel = user.cefr_level || "B1";
  // Hard genre gate: never fall back to the mixed catalog when the user picked a style.
  const genreFiltered =
    userGenre === "any"
      ? uniqueCandidates
      : uniqueCandidates.filter((s) => aiService.genresCompatible(s.genre, userGenre));
  const ranked = genreFiltered.slice().sort(
    (a, b) =>
      candidateRankScore(b, userGenre, userDifficulty, effectiveLevel) -
      candidateRankScore(a, userGenre, userDifficulty, effectiveLevel)
  );

  const partials = [];
  const usedWords = new Set();
  let resolveEarly = null;
  const earlyDone = new Promise((resolve) => { resolveEarly = resolve; });
  let stopped = false;

  const poolPromise = runValidationPool(ranked, async (suggestion) => {
    const result = await tryValidateSongCandidate(
      suggestion, user, date, avoidWords, fetchImpl, seenSongIds, {
        allowSongReuse: relaxSongReuse,
        allowOutsidePreview: relaxSongReuse,
      }
    );
    if (result.picked) {
      const key = result.picked.word.toLowerCase();
      if (!usedWords.has(key)) {
        usedWords.add(key);
        avoidWords.add(key);
        seenSongIds.add(String(result.track.id));
        partials.push(result);
        // Return the first word as soon as we have `stopAfter`, but keep
        // validating until QUEUE_BATCH_SIZE so Next Word stays instant.
        if (partials.length >= stopAfter && resolveEarly) {
          resolveEarly();
          resolveEarly = null;
        }
        if (partials.length >= QUEUE_BATCH_SIZE) {
          stopped = true;
        }
      }
    } else if (result.error) {
      lastError = result.error;
    }
    return result;
  }, { isStopped: () => stopped });

  if (stopAfter < ranked.length) {
    await Promise.race([earlyDone, poolPromise]);
  } else {
    await poolPromise;
  }

  if (!partials.length) {
    await poolPromise;
    return { valid: [], sideEffects: [], lastError, candidateCount: candidates.length };
  }

  const languageName = languageNameFromCode(user.target_language || "es");
  const nativeLanguageName = languageNameFromCode(user.native_language || "en", "English");
  const glossTarget = partials.slice(0, stopAfter);
  const glosses = await glossWithCompleteness(
    glossTarget.map((p) => ({ word: p.picked.word, line: p.picked.line })),
    languageName,
    nativeLanguageName,
    {
      fast: stopAfter <= USER_DELIVER_STOP_AFTER,
      fromLang: normalizeLangCode(user.target_language || "es"),
      toLang: normalizeLangCode(user.native_language || "en"),
    }
  );

  const buildResults = (items, glossList) => items.map((p, i) => {
    const gloss = glossList[i] || { translation: null, part_of_speech: null, pronunciation: null };
    const wordSuggestion = {
      target_word: p.picked.word,
      translation: gloss.translation,
      part_of_speech: gloss.part_of_speech,
      pronunciation: gloss.pronunciation,
      line_translation: gloss.line_translation || null,
      gloss_v: gloss.gloss_v || 2,
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
    await poolPromise;
    const fresh = db.prepare(
      "SELECT genre, target_language FROM users WHERE id = ?"
    ).get(user.id);
    const expectedGenre = fresh?.genre || user.genre || "pop";
    const expectedLang = fresh?.target_language || user.target_language || "es";

    const extraPartials = partials.slice(glossTarget.length);
    if (!extraPartials.length) return { queued: 0 };

    const extraGlosses = await glossWithCompleteness(
      extraPartials.map((p) => ({ word: p.picked.word, line: p.picked.line })),
      languageName,
      nativeLanguageName,
      {
        fast: false,
        fromLang: normalizeLangCode(user.target_language || "es"),
        toLang: normalizeLangCode(user.native_language || "en"),
      }
    );
    const extraResults = buildResults(extraPartials, extraGlosses)
      .filter((effect) => (
        payloadMatchesUserLanguage(effect.payload, expectedLang) &&
        payloadMatchesUserGenre(effect.payload, expectedGenre)
      ));
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
    finishBackground:
      stopAfter < Math.min(QUEUE_BATCH_SIZE, ranked.length) ? finishBackground : null,
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

/** True when this user still has unused curated/verified songs for their chosen genre. */
function hasUnusedSongCandidates(userId, langCode, genre) {
  const pool = getFullSongCandidatePool(langCode, genre || "pop");
  return filterUnusedSongCandidates(userId, pool).length > 0;
}

function getCuratedCandidatesForBatch(userId, langCode, genre) {
  const verified = shuffleInPlace([...aiService.getVerifiedSongCandidates(langCode, genre)]);
  const curated = aiService.getCuratedSongCandidates(langCode, genre);
  const freshVerified = filterUnusedSongCandidates(userId, verified);
  const freshCurated = filterUnusedSongCandidates(userId, curated);
  let merged = mergeCandidateLists(freshVerified, freshCurated);

  const profile = spotifyProfileService.getUserMusicProfile(userId);
  if (profile && Array.isArray(profile.top_artists) && profile.top_artists.length > 0) {
    const artistSet = new Set(profile.top_artists.map((a) => String(a).toLowerCase()));
    const spotifyFavs = [];
    const rest = [];
    for (const song of merged) {
      const songArtist = String(song.artist || '').toLowerCase();
      if (artistSet.has(songArtist)) {
        spotifyFavs.push(song);
      } else {
        rest.push(song);
      }
    }
    merged = [...shuffleInPlace(spotifyFavs), ...shuffleInPlace(rest)];
  } else {
    merged = shuffleInPlace(merged);
  }

  return merged;
}

function getFullSongCandidatePool(langCode, genre) {
  const verified = aiService.getVerifiedSongCandidates(langCode, genre);
  const all = aiService.getCuratedSongCandidates(langCode, genre);
  return shuffleInPlace(mergeCandidateLists(verified, all));
}

function filterUniquePayloads(userId, payloads) {
  const history = getUserDiscoveryHistory(userId);
  const seenWords = new Set(history.words);
  const seenSongIds = new Set(history.songIds);
  const seenSongKeys = new Set(history.songKeys);
  const unique = [];

  for (const payload of payloads || []) {
    const word = payload?.word?.text?.toLowerCase();
    if (!word) continue;
    if (seenWords.has(word)) continue;

    const songId = payload?.song?.id != null ? String(payload.song.id) : null;
    const songKey =
      payload?.song?.artist && payload?.song?.title
        ? `${String(payload.song.artist).toLowerCase()}|${String(payload.song.title).toLowerCase()}`
        : null;

    // Prefer a new song for every new word until the unused catalog is gone.
    // from-track extras opt in to more words from the same lyrics.
    if (!payload.allow_same_song) {
      if (songId && seenSongIds.has(songId)) continue;
      if (songKey && seenSongKeys.has(songKey)) continue;
    }

    seenWords.add(word);
    if (!payload.allow_same_song) {
      if (songId) seenSongIds.add(songId);
      if (songKey) seenSongKeys.add(songKey);
    }
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

function payloadMatchesUserGenre(payload, userGenre) {
  const u = aiService.normalizeGenre(userGenre || "pop");
  if (u === "any") return true;
  // Honest widen after on-style exhaustion — accept only while user still has that style.
  if (payload?.style_relaxed === true) {
    const from = payload.style_relaxed_from || payload.requested_genre;
    if (!from) return true;
    return aiService.normalizeGenre(from) === u;
  }
  const stamped = payload?.preferred_genre || payload?.song?.genre;
  return aiService.genresCompatible(stamped, u);
}

function getCachedDailyWord(userId, date, langCode = "es", userGenre = "any") {
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
    if (!payloadMatchesUserGenre(payload, userGenre)) return null;
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
  const song = payload.song
    ? {
        id: payload.song.id,
        title: payload.song.title,
        artist: payload.song.artist,
        cover:
          payload.song.cover ||
          payload.song.cover_medium ||
          payload.song.album?.cover_medium ||
          payload.song.album?.cover ||
          null,
      }
    : null;
  const audio = song?.id
    ? {
        preview_url: deezer.previewProxyPath(
          String(song.id),
          song.artist,
          song.title
        ),
        duration_seconds: payload.audio?.duration_seconds ?? null,
        preview_offset: payload.audio?.preview_offset ?? 30,
      }
    : null;
  return {
    id: meta.id ?? null,
    date: payload.date,
    discovered_at: meta.generated_at ?? null,
    word: {
      text: payload.word.text,
      translation: payload.word.translation || null,
      pronunciation: payload.word.pronunciation || null,
      part_of_speech: payload.word.part_of_speech || null,
    },
    // Top-level aliases so clients always get title + phrase even if they
    // only read flat fields.
    title: song?.title || null,
    phrase: (payload.lyric?.snippet || "").trim() || null,
    lyric: payload.lyric
      ? {
          snippet: payload.lyric.snippet || "",
          timestamp: payload.lyric.timestamp || "",
          timestamp_ms: payload.lyric.timestamp_ms ?? null,
          char_start: payload.lyric.char_start ?? 0,
          char_end: payload.lyric.char_end ?? 0,
          in_preview: payload.lyric.in_preview ?? null,
        }
      : null,
    song,
    audio,
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
    // Soft progress target only — users may request unlimited new words.
    daily_goal: 10,
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
  const genre = user.genre || "pop";
  if (!hasUnusedSongCandidates(user.id, langCode, genre)) {
    return [];
  }
  const languageName = languageNameFromCode(langCode);
  const difficulty = user.difficulty || "medium";
  const history = getUserDiscoveryHistory(user.id);
  const avoidSongs = [...history.songKeys];

  const profile = spotifyProfileService.getUserMusicProfile(user.id);
  const spotifyTopArtists = profile?.top_artists || [];

  try {
    const aiResult = await aiService.generateDailyWordSongs({
      languageName,
      languageCode: langCode,
      genre,
      difficulty,
      avoidSongs,
      spotifyTopArtists,
    });
    const list = Array.isArray(aiResult) ? aiResult : [aiResult];
    // Hard filter: never feed already-used songs into validation while unused remain.
    return filterUnusedSongCandidates(user.id, list);
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
      const userWaiting = stopAfter <= USER_DELIVER_STOP_AFTER;
      merged = getFullSongCandidatePool(langCode, genre).slice(0, userWaiting ? 6 : 16);
      console.log(`daily word batch: retrying ${merged.length} candidates allowing new words from known songs`);
    } else {
      const userWaiting = stopAfter <= USER_DELIVER_STOP_AFTER;
      const curated = getCuratedCandidatesForBatch(user.id, langCode, genre).slice(
        0,
        userWaiting ? 8 : 15
      );

      // Start AI candidate fetch immediately — don't block curated validation on it.
      const aiPromise = fetchAiCandidates(user).catch((err) => {
        if (err.code === "ai_rate_limit") throw err;
        console.warn(`daily word: AI song pick failed (${err.code || err.message})`);
        return [];
      });

      if (userWaiting && curated.length) {
        const curatedResult = await validateAllCandidates(curated, date, user, fetchImpl, {
          ...options,
          tryCuratedFirst: false,
          stopAfter,
          relaxSongReuse,
        });
        if (curatedResult.valid.length) {
          // Keep AI warm for background refill; don't make the user wait for it.
          void aiPromise;
          return curatedResult;
        }
      }

      let candidates = [];
      try {
        candidates = await aiPromise;
      } catch (err) {
        if (err.code === "ai_rate_limit") throw err;
        if (!curated.length) {
          return { valid: [], sideEffects: [], lastError: err.code || err.message || "generation_failed" };
        }
      }

      // User-facing cold path: curated already failed above — validate AI picks next.
      // Background refill still prefers curated-first for throughput.
      merged = userWaiting
        ? mergeCandidateLists(candidates, [])
        : mergeCandidateLists(curated, candidates);
      if (userWaiting && !merged.length && curated.length) {
        merged = curated;
      }
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

  if (!hasUnusedSongCandidates(user.id, langCode, genre)) {
    console.log(`daily word batch: unused catalog empty for ${langCode}/${genre} — reuse pool, skip AI song pick`);
    return runOnce(true);
  }

  let result = await runOnce(false);
  // Only reuse known songs when this user has exhausted unused catalog songs.
  // Otherwise "Next word" keeps returning different words from the same track.
  // Also relax when unused *keys* remain but every resolve hits a used Deezer id
  // (`song_already_used`) — otherwise cold Next/New 503s forever on thin pools.
  if (!result.valid.length && !hasUnusedSongCandidates(user.id, langCode, genre)) {
    console.log(`daily word batch: unused catalog exhausted for ${langCode}/${genre} — allowing song reuse`);
    result = await runOnce(true);
  } else if (!result.valid.length && result.lastError === "song_already_used") {
    console.log(
      `daily word batch: unused pass yielded only song_already_used for ${langCode}/${genre} — allowing song reuse for new words`
    );
    result = await runOnce(true);
  } else if (!result.valid.length) {
    console.warn(
      `daily word batch: no valid unused songs this round for ${langCode}/${genre} (catalog still has unused — not reusing songs)`
    );
  }
  return result;
}

async function persistBatchSideEffects(sideEffects) {
  for (const effect of sideEffects) {
    persistPayloadSideEffects(effect.payload, effect.track, effect.lyricsData, effect.syncCheck);
  }
}

async function deliverFromBatch(user, batch, fetchImpl, { fromQueue = false, preferenceEpoch = null } = {}) {
  const fresh = db.prepare(
    "SELECT genre, target_language FROM users WHERE id = ?"
  ).get(user.id);
  const expectedGenre = fresh?.genre || user.genre || "pop";
  const expectedLang = fresh?.target_language || user.target_language || "es";
  if (
    preferenceEpoch != null &&
    preferenceEpoch !== currentPreferenceEpoch(user.id)
  ) {
    const err = new Error("daily_word_stale_preferences");
    err.code = "stale_preferences";
    throw err;
  }

  // batch.valid is an array of payloads (see validateAllCandidates).
  const matching = (batch.valid || []).filter((payload) => (
    payloadMatchesUserLanguage(payload, expectedLang) &&
    payloadMatchesUserGenre(payload, expectedGenre)
  ));
  if (!matching.length) {
    const err = new Error("daily_word_stale_preferences");
    err.code = "stale_preferences";
    throw err;
  }

  await persistBatchSideEffects(
    (batch.sideEffects || []).filter((effect) =>
      matching.some((payload) => payload === effect.payload)
    )
  );
  const [first, ...rest] = matching;
  if (rest.length) {
    const uniqueRest = filterUniquePayloads(user.id, rest);
    const inserted = wordQueue.enqueuePayloads(user.id, uniqueRest);
    if (uniqueRest.length < rest.length) {
      console.log(`daily word batch: skipped ${rest.length - uniqueRest.length} duplicate queued words`);
    }
    console.log(`daily word batch: delivered 1, queued ${inserted}/${uniqueRest.length} (${matching.length}/${batch.candidateCount} validated)`);
  } else {
    console.log(`daily word batch: delivered 1 (${matching.length}/${batch.candidateCount} validated)`);
  }
  const delivered = deliverPayload(user.id, first, { fromQueue });
  const firstEffect = (batch.sideEffects || []).find((effect) => effect.payload === first);
  if (firstEffect?.track && firstEffect?.lyricsData) {
    // Same-song extras must not block the first card. Table glosses fill the
    // queue in the background so Next word is actually instant.
    const extraPromise = queueExtraWordsFromValidatedSong(user, {
      firstWord: first.word?.text,
      track: firstEffect.track,
      lyricsData: firstEffect.lyricsData,
      syncCheck: firstEffect.syncCheck,
      genre: first.song?.genre || user.genre,
      date: first.date || todayDate(),
      fetchImpl,
    }).then((extra) => {
      if (extra) {
        console.log(`daily word batch: queued ${extra} extra words from ${first.song?.title}`);
      }
      return extra;
    }).catch((err) => {
      console.warn(`daily word batch extras failed:`, err.message || err);
    });
    if (process.env.NODE_ENV === "test") {
      await extraPromise;
    }
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
  return delivered;
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

function markStyleRelaxed(batch, fromGenre) {
  const from = aiService.normalizeGenre(fromGenre || "pop");
  if (from === "any") return batch;
  const valid = (batch.valid || []).map((payload) => ({
    ...payload,
    style_relaxed: true,
    style_relaxed_from: from,
    requested_genre: from,
  }));
  const sideEffects = (batch.sideEffects || []).map((effect) => ({
    ...effect,
    payload: effect.payload
      ? {
          ...effect.payload,
          style_relaxed: true,
          style_relaxed_from: from,
          requested_genre: from,
        }
      : effect.payload,
  }));
  return { ...batch, valid, sideEffects };
}

async function generateAndDeliverBatch(user, fetchImpl = fetch, { maxAttempts = 2, maxMs = 75000 } = {}) {
  return withUserBatchLock(user.id, async () => {
    const started = Date.now();
    const deadline = started + maxMs;
    let lastError = "unknown";
    const preferenceEpoch = currentPreferenceEpoch(user.id);
    const requestedGenre = aiService.normalizeGenre(user.genre || "pop");

    for (let attempt = 0; attempt < maxAttempts && Date.now() < deadline; attempt++) {
      if (preferenceEpoch !== currentPreferenceEpoch(user.id)) {
        const err = new Error("daily_word_stale_preferences");
        err.code = "stale_preferences";
        throw err;
      }
      const batch = await generateValidatedBatch(user, fetchImpl, { stopAfter: USER_DELIVER_STOP_AFTER });
      if (batch.valid.length) {
        console.log(`daily word batch: first valid in ${Date.now() - started}ms (attempt ${attempt + 1})`);
        return deliverFromBatch(user, batch, fetchImpl, { preferenceEpoch });
      }
      lastError = batch.lastError || "unknown";
      console.warn(
        `daily word batch attempt ${attempt + 1}/${maxAttempts}: 0/${batch.candidateCount || 5} passed (${lastError})`
      );
    }

    // On-style pool truly failed — one honest widen to mixed catalog (UI shows style_relaxed).
    if (requestedGenre !== "any" && Date.now() < deadline) {
      if (preferenceEpoch !== currentPreferenceEpoch(user.id)) {
        const err = new Error("daily_word_stale_preferences");
        err.code = "stale_preferences";
        throw err;
      }
      console.log(
        `daily word batch: on-style exhausted for ${requestedGenre} — widening to any (honest match)`
      );
      const widenedUser = { ...user, genre: "any" };
      const wideBatch = await generateValidatedBatch(widenedUser, fetchImpl, {
        stopAfter: USER_DELIVER_STOP_AFTER,
      });
      if (wideBatch.valid.length) {
        const marked = markStyleRelaxed(wideBatch, requestedGenre);
        return deliverFromBatch(user, marked, fetchImpl, { preferenceEpoch });
      }
      lastError = wideBatch.lastError || lastError;
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

function purgeQueueWrongLanguage(userId, langCode) {
  const expected = normalizeLangCode(langCode);
  for (const item of wordQueue.listReadyItems(userId)) {
    if (!payloadMatchesUserLanguage(item.payload, expected)) {
      wordQueue.discard(item.id);
    }
  }
}

function purgeQueueWrongGenre(userId, userGenre) {
  const expected = aiService.normalizeGenre(userGenre || "pop");
  if (expected === "any") return;
  for (const item of wordQueue.listReadyItems(userId)) {
    if (!payloadMatchesUserGenre(item.payload, expected)) {
      wordQueue.discard(item.id);
    }
  }
}

async function consumeNextDailyWord(user, fetchImpl = fetch) {
  const langCode = normalizeLangCode(user.target_language || "es");
  const userGenre = user.genre || "pop";
  purgeQueueWrongLanguage(user.id, langCode);
  purgeQueueWrongGenre(user.id, userGenre);
  const maxSkips = wordQueue.QUEUE_MAX + 5;

  for (let i = 0; i < maxSkips; i++) {
    const item = wordQueue.peekNext(user.id);
    if (!item) return null;

    if (!payloadMatchesUserLanguage(item.payload, langCode)) {
      console.warn(`daily word skip: wrong language for "${item.payload.word?.text}" (want ${langCode})`);
      wordQueue.discard(item.id);
      continue;
    }

    if (!payloadMatchesUserGenre(item.payload, userGenre)) {
      console.warn(
        `daily word skip: wrong genre for "${item.payload.song?.title}" (want ${userGenre}, got ${item.payload.song?.genre || item.payload.preferred_genre || "untagged"})`
      );
      wordQueue.discard(item.id);
      continue;
    }

    wordQueue.consumeById(item.id);
    const queued = item.payload;

    const history = getUserDiscoveryHistory(user.id);
    const word = String(queued.word?.text || "").toLowerCase();
    if (word && history.words.has(word)) {
      console.warn(`daily word skip: duplicate queued word "${queued.word?.text}"`);
      continue;
    }

    const songId = queued.song?.id != null ? String(queued.song.id) : null;
    const songKey =
      queued.song?.artist && queued.song?.title
        ? `${String(queued.song.artist).toLowerCase()}|${String(queued.song.title).toLowerCase()}`
        : null;
    if (
      !queued.allow_same_song &&
      ((songId && history.songIds.has(songId)) ||
        (songKey && history.songKeys.has(songKey)))
    ) {
      console.warn(
        `daily word skip: duplicate queued song "${queued.song?.artist} — ${queued.song?.title}"`
      );
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
  const provider =
    payload.audio.preview_provider
    || (deezer.isItunesTrackId?.(payload.song.id) ? "itunes" : "deezer");
  payload.audio.preview_provider = provider;
  payload.audio.preview_offset = previewOffset(
    payload.audio.duration_seconds || 0,
    provider
  );
  payload.audio.preview_end = payload.audio.preview_offset + 30;
  payload.audio.preview_url = deezer.previewProxyPath(
    String(payload.song.id),
    payload.song.artist,
    payload.song.title
  );
  return payload;
}

function translationNeedsFix(word) {
  if (!word?.text) return false;
  const translation = String(word.translation || "").trim();
  return !translation || translation.toLowerCase() === word.text.toLowerCase();
}

/** Blocking path only — missing gloss or obvious idiom calque. */
function glossNeedsQualityCheck(word) {
  if (!word?.text) return false;
  if (translationNeedsFix(word)) return true;
  return aiService.translationLooksSuspicious(word.text, word.translation);
}

function wordMetaNeedsEnrichment(word) {
  return glossNeedsQualityCheck(word);
}

function shouldBackgroundPolish(word) {
  return Boolean(word?.text)
    && (Number(word.gloss_v || 0) < 2 || !word?.pronunciation)
    && !wordMetaNeedsEnrichment(word);
}

async function dictionaryOnlyGlosses(items, fromLang, toLang) {
  return Promise.all(items.map(async (item) => {
    const fb = fromLang && toLang
      ? await aiService.dictionaryGlossFallback(item.word, fromLang, toLang, fetch, item.line)
      : null;
    return {
      translation: fb || null,
      part_of_speech: null,
      pronunciation: null,
      gloss_v: fb ? 2 : 1,
    };
  }));
}

async function glossWithCompleteness(items, languageName, nativeLanguageName, {
  fast = false,
  fromLang = null,
  toLang = null,
} = {}) {
  if (!items?.length) return [];
  let glosses;
  try {
    glosses = await aiService.glossDailyWords(items, languageName, {
      fast,
      nativeLanguageName,
      refine: false,
      fromLang,
      toLang,
    });
  } catch (err) {
    console.warn(`daily word gloss failed (${err.status || err.code || err.message}) — dictionary fallback`);
    return dictionaryOnlyGlosses(items, fromLang, toLang);
  }

  const needsRefine = items.some((item, i) => (
    translationNeedsFix({ text: item.word, translation: glosses[i]?.translation })
    || aiService.translationLooksSuspicious(item.word, glosses[i]?.translation, item.line)
  ));
  if (needsRefine) {
    try {
      glosses = await aiService.refineGlosses(
        items,
        glosses,
        languageName,
        nativeLanguageName,
        { fast }
      );
    } catch (err) {
      console.warn(`daily word refine failed (${err.status || err.code || err.message}) — keep current glosses`);
    }
    // After refine, still rescue with dictionary if needed.
    if (fromLang && toLang) {
      glosses = await Promise.all(glosses.map(async (g, i) => {
        const item = items[i];
        if (g?.translation
          && !aiService.translationLooksSuspicious(item.word, g.translation, item.line)) {
          return g;
        }
        const fb = await aiService.dictionaryGlossFallback(
          item.word,
          fromLang,
          toLang,
          fetch,
          item.line
        );
        if (!fb) return { ...(g || {}), translation: null };
        return aiService.sanitizeGloss(item.word, {
          translation: fb,
          part_of_speech: g?.part_of_speech,
          pronunciation: g?.pronunciation,
        }, item.line);
      }));
    }
  }

  // Never escalate to the slow (60s NIM) path on user-facing requests — background
  // polish fills gaps after we return. Slow escalate previously caused 20–30s Next Word.
  return glosses.map((g, i) => ({
    ...g,
    gloss_v: (
      g?.translation
      && !aiService.translationLooksSuspicious(items[i].word, g.translation, items[i].line)
    ) ? 2 : 1,
  }));
}

async function enrichPayloadWordMeta(payload, user) {
  const text = payload?.word?.text;
  const line = payload?.lyric?.snippet;
  if (!text || !wordMetaNeedsEnrichment(payload.word)) return payload;

  const fromLang = normalizeLangCode(user.target_language || "es");
  const toLang = normalizeLangCode(user.native_language || "en");
  const started = Date.now();

  try {
    // Request path: table + dictionary only. Muse timeouts were adding 6–14s
    // to every Next word even when the queue already had the payload.
    const tableHit = aiService.commonGlossLookup(text, fromLang, toLang, line);
    if (tableHit && !aiService.translationLooksSuspicious(text, tableHit, line)) {
      console.log(`daily word enrich gloss: ${text} in ${Date.now() - started}ms (table)`);
      return {
        ...payload,
        word: { ...payload.word, translation: tableHit, gloss_v: 2 },
      };
    }
    const fb = await aiService.dictionaryGlossFallback(text, fromLang, toLang, fetch, line);
    if (fb && !aiService.translationLooksSuspicious(text, fb, line)) {
      console.log(`daily word enrich gloss: ${text} in ${Date.now() - started}ms (dictionary)`);
      return {
        ...payload,
        word: { ...payload.word, translation: fb, gloss_v: 2 },
      };
    }
    return payload;
  } catch (err) {
    console.warn(`daily word enrich gloss failed in ${Date.now() - started}ms: ${err.message || err}`);
    return payload;
  }
}

function scheduleBackgroundGlossPolish(user, payload) {
  if (process.env.NODE_ENV === "test" || !user?.id || !payload?.word?.text) return;
  setImmediate(() => {
    (async () => {
      try {
        const text = payload.word.text;
        const line = payload.lyric?.snippet || null;
        const translation = payload.word.translation;
        // Healthy glosses: stamp gloss_v without another AI call.
        if (
          translation
          && !translationNeedsFix(payload.word)
          && !aiService.translationLooksSuspicious(text, translation, line)
        ) {
          if (Number(payload.word.gloss_v || 0) < 2) {
            saveDailyWord(user.id, payload.date || todayDate(), {
              ...payload,
              word: { ...payload.word, gloss_v: 2 },
            });
          }
          return;
        }

        const languageName = languageNameFromCode(user.target_language || "es");
        const nativeLanguageName = languageNameFromCode(user.native_language || "en", "English");
        const item = [{ word: text, line }];
        if (!item[0].line) return;
        const glosses = await aiService.glossDailyWords(item, languageName, {
          fast: true,
          nativeLanguageName,
          refine: true,
          fromLang: normalizeLangCode(user.target_language || "es"),
          toLang: normalizeLangCode(user.native_language || "en"),
        });
        const gloss = glosses[0];
        if (!gloss?.translation) return;
        if (aiService.translationLooksSuspicious(text, gloss.translation, line)) return;
        const enriched = {
          ...payload,
          word: {
            ...payload.word,
            translation: gloss.translation,
            part_of_speech: gloss.part_of_speech ?? payload.word.part_of_speech,
            pronunciation: gloss.pronunciation ?? payload.word.pronunciation,
            gloss_v: 2,
          },
        };
        saveDailyWord(user.id, enriched.date || todayDate(), enriched);
        console.log(`daily word background gloss polish: ${text}`);
      } catch (err) {
        console.warn(`background gloss polish failed: ${err.message || err}`);
      }
    })();
  });
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

  // Queued / cached words with a usable gloss must return immediately.
  if (!wordMetaNeedsEnrichment(hydrated.word)) {
    if (shouldBackgroundPolish(hydrated.word)) {
      scheduleBackgroundGlossPolish(user, hydrated);
    }
    return hydrated;
  }

  const enriched = await enrichPayloadWordMeta(hydrated, user);
  const w = enriched.word || {};
  const prev = hydrated.word || {};
  const changed = w.translation !== prev.translation
    || w.pronunciation !== prev.pronunciation
    || w.part_of_speech !== prev.part_of_speech
    || w.gloss_v !== prev.gloss_v;
  if (changed && user?.id) {
    saveDailyWord(user.id, enriched.date || todayDate(), enriched);
  }
  // If still thin after fast enrich, polish in background — do not block the user.
  if (wordMetaNeedsEnrichment(enriched.word) || shouldBackgroundPolish(enriched.word)) {
    scheduleBackgroundGlossPolish(user, enriched);
  }
  return enriched;
}

async function queueExtraWordsFromValidatedSong(user, {
  firstWord,
  track,
  lyricsData,
  syncCheck,
  genre,
  date,
  fetchImpl = fetch,
}) {
  const langCode = normalizeLangCode(user.target_language || "es");
  const avoid = new Set(getUserDiscoveryHistory(user.id).words);
  if (firstWord) avoid.add(String(firstWord).toLowerCase());

  const extras = [];
  const plain = plainFromLyricsData(lyricsData);
  const pickOpts = { songTitle: track.title || "", artist: track.artist || "" };
  const duration = track.duration;
  const provider =
    track.provider === "itunes" || deezer.isItunesTrackId?.(track.id) ? "itunes" : "deezer";

  for (let i = 0; i < QUEUE_BATCH_SIZE - 1; i += 1) {
    const picked = pickWordFromLyricsHeuristic(
      plain,
      user.difficulty || "medium",
      avoid,
      langCode,
      pickOpts
    );
    if (!picked) break;
    avoid.add(picked.word.toLowerCase());
    const occurrence = findWordOccurrence(picked.word, lyricsData.syncedLyrics, plain, {
      duration,
      provider,
    });
    if (!occurrence) continue;
    extras.push({ picked, occurrence });
  }
  if (!extras.length) {
    scheduleRefill(user, fetchImpl);
    return 0;
  }

  const toLang = normalizeLangCode(user.native_language || "en");
  const glosses = extras.map((item) => {
    const translation = aiService.commonGlossLookup(
      item.picked.word,
      langCode,
      toLang,
      item.picked.line
    );
    return {
      translation: translation || null,
      part_of_speech: null,
      pronunciation: null,
      gloss_v: translation ? 2 : 1,
    };
  });

  const payloads = extras.map((item, i) => {
    const gloss = glosses[i] || {};
    const wordSuggestion = {
      target_word: item.picked.word,
      translation: gloss.translation,
      part_of_speech: gloss.part_of_speech,
      pronunciation: gloss.pronunciation,
      line_translation: gloss.line_translation || null,
      gloss_v: gloss.gloss_v || 2,
      difficulty: user.difficulty || "medium",
      genre,
    };
    const payload = buildPayload(
      date,
      wordSuggestion,
      track,
      lyricsData,
      item.occurrence,
      user.target_language || "es"
    );
    payload.allow_same_song = true;
    persistPayloadSideEffects(payload, track, lyricsData, syncCheck);
    return payload;
  });

  const inserted = wordQueue.enqueuePayloads(user.id, filterUniquePayloads(user.id, payloads));
  if (inserted) {
    console.log(`daily word from-track: queued ${inserted} extra words from ${track.title}`);
  }
  scheduleRefill(user, fetchImpl);
  return inserted;
}

async function generateDailyWordFromTrack(user, trackId, fetchImpl = fetch) {
  const date = todayDate();
  const id = String(trackId || "").trim();
  if (!id) {
    const err = new Error("track_required");
    err.code = "track_required";
    throw err;
  }

  let track;
  try {
    track = await deezer.fetchTrack(id, fetchImpl);
  } catch (err) {
    const wrapped = new Error(err.code || err.message || "deezer_not_found");
    wrapped.code = err.code || "deezer_not_found";
    throw wrapped;
  }
  if (!track) {
    const err = new Error("deezer_not_found");
    err.code = "deezer_not_found";
    throw err;
  }

  const suggestion = {
    artist: track.artist?.name || "",
    song_title: track.title || "",
    genre: user.genre || "pop",
  };
  const history = getUserDiscoveryHistory(user.id);
  const result = await tryValidateSongCandidate(
    suggestion,
    user,
    date,
    history.words,
    fetchImpl,
    new Set(),
    { allowSongReuse: true, allowOutsidePreview: true, knownTrack: track }
  );
  if (!result.picked) {
    const err = new Error(result.error || "generation_failed");
    err.code = result.error || "generation_failed";
    throw err;
  }

  const languageName = languageNameFromCode(user.target_language || "es");
  const nativeLanguageName = languageNameFromCode(user.native_language || "en", "English");
  const glosses = await glossWithCompleteness(
    [{ word: result.picked.word, line: result.picked.line }],
    languageName,
    nativeLanguageName,
    {
      fast: true,
      fromLang: normalizeLangCode(user.target_language || "es"),
      toLang: normalizeLangCode(user.native_language || "en"),
    }
  );
  const gloss = glosses[0] || {};
  const wordSuggestion = {
    target_word: result.picked.word,
    translation: gloss.translation,
    part_of_speech: gloss.part_of_speech,
    pronunciation: gloss.pronunciation,
    line_translation: gloss.line_translation || null,
    gloss_v: gloss.gloss_v || 2,
    difficulty: user.difficulty || "medium",
    genre: result.genre,
  };
  const payload = buildPayload(
    date,
    wordSuggestion,
    result.track,
    result.lyricsData,
    result.occurrence,
    user.target_language || "es"
  );
  persistPayloadSideEffects(payload, result.track, result.lyricsData, result.syncCheck);
  const delivered = deliverPayload(user.id, payload);
  void queueExtraWordsFromValidatedSong(user, {
    firstWord: result.picked.word,
    track: result.track,
    lyricsData: result.lyricsData,
    syncCheck: result.syncCheck,
    genre: result.genre,
    date,
    fetchImpl,
  }).catch((err) => {
    console.warn(`daily word from-track extras failed:`, err.message || err);
  });
  return enrichIfNeeded(delivered, user);
}

async function generateDailyWord(user, { force = false, fetchImpl = fetch } = {}) {
  const date = todayDate();

  if (!force) {
    purgeQueueWrongLanguage(user.id, user.target_language || "es");
    purgeQueueWrongGenre(user.id, user.genre || "pop");
    const cached = getCachedDailyWord(
      user.id,
      date,
      user.target_language || "es",
      user.genre || "pop"
    );
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
  previewWindow,
  isTimestampInPreview,
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
  fetchAiCandidates,
  generateValidatedBatch,
  refillQueue,
  consumeNextDailyWord,
  generateNextDailyWord,
  generateAndDeliverBatch,
  generateDailyWord,
  generateDailyWordFromTrack,
  queueExtraWordsFromValidatedSong,
  hydratePayloadAudio,
  enrichPayloadWordMeta,
  enrichIfNeeded,
  translationNeedsFix,
  glossNeedsQualityCheck,
  wordMetaNeedsEnrichment,
  backfillQueueMetadata,
  glossWithCompleteness,
  getUserDiscoveryHistory,
  filterUniquePayloads,
  filterUnusedSongCandidates,
  hasUnusedSongCandidates,
  getFullSongCandidatePool,
  getCuratedCandidatesForBatch,
  purgeQueueWrongLanguage,
  purgeQueueWrongGenre,
  payloadMatchesUserLanguage,
  payloadMatchesUserGenre,
  abortRefill,
  bumpPreferenceEpoch,
  VALIDATE_CONCURRENCY,
};
