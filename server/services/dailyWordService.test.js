const { expect } = require("chai");
const db = require("../db");
const {
  formatTimestamp,
  previewOffset,
  findWordOccurrence,
  getCachedDailyWord,
  saveDailyWord,
  getRecentDailyWords,
  validateAllCandidates,
  generateValidatedBatch,
  consumeNextDailyWord,
  pickNextQueueItem,
  queueSameSongFallback,
  getRecentArtists,
  generateNextDailyWord,
  generateDailyWord,
  fetchAiCandidates,
  enrichPayloadWordMeta,
  pickWordFromLyricsHeuristic,
  pickWordsFromText,
  filterUniquePayloads,
  filterUnusedSongCandidates,
  getCuratedCandidatesForBatch,
  getFullSongCandidatePool,
  hasUnusedSongCandidates,
  getUserDiscoveryHistory,
  purgeQueueWrongLanguage,
  VALIDATE_CONCURRENCY,
} = require("./dailyWordService");
const wordQueue = require("./wordQueueService");
const aiService = require("./aiService");

function stubSongPipeline(songCandidates) {
  const originalSongs = aiService.generateDailyWordSongs;
  const originalGloss = aiService.glossDailyWords;
  const originalRefine = aiService.refineGlosses;
  aiService.generateDailyWordSongs = async () => songCandidates;
  aiService.glossDailyWords = async (items) =>
    items.map((item) => ({
      translation: `${item.word}-en`,
      part_of_speech: "noun",
      pronunciation: "/x/",
    }));
  aiService.refineGlosses = async (items, glosses) =>
    items.map((item, i) => ({
      translation: glosses?.[i]?.translation || `${item.word}-en`,
      part_of_speech: glosses?.[i]?.part_of_speech || "noun",
      pronunciation: glosses?.[i]?.pronunciation || "/x/",
    }));
  return () => {
    aiService.generateDailyWordSongs = originalSongs;
    aiService.glossDailyWords = originalGloss;
    aiService.refineGlosses = originalRefine;
  };
}

describe("Daily Word Service", () => {
  const userId = "daily-word-test-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "daily@test.com", "x");
    db.prepare(`
      UPDATE users
      SET native_language = 'en', target_language = 'es', genre = 'pop', difficulty = 'medium'
      WHERE id = ?
    `).run(userId);
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_word_queue WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_queue_refill WHERE user_id = ?").run(userId);
    // Avoid stale LRC from prior runs (preview-window checks depend on timestamps).
    try {
      db.prepare("DELETE FROM song_lyrics_snapshot").run();
    } catch {
      /* table may not exist in older DBs */
    }
  });

  it("formats timestamps as m:ss", () => {
    expect(formatTimestamp(83000)).to.equal("1:23");
    expect(formatTimestamp(5000)).to.equal("0:05");
  });

  it("calculates preview offset heuristics", () => {
    expect(previewOffset(180)).to.equal(30);
    expect(previewOffset(45)).to.equal(15);
    expect(previewOffset(25)).to.equal(0);
  });

  it("prefers Deezer mid-preview occurrences over opening lines", () => {
    const { isTimestampInPreview } = require("./dailyWordService");
    expect(isTimestampInPreview(45000, 180)).to.equal(true); // 0:45 in [30,60]
    expect(isTimestampInPreview(10000, 180)).to.equal(false); // 0:10 outside Deezer mid window
    const lrc =
      "[00:10.00] Early word forever\n[00:45.00] Later word forever in chorus";
    const hit = findWordOccurrence("forever", lrc, null, { duration: 180, provider: "deezer" });
    expect(hit).to.not.be.null;
    expect(hit.timestamp).to.equal("0:45");
    expect(hit.in_preview).to.equal(true);
  });

  it("prefers opening-window hits for iTunes previews", () => {
    const lrc =
      "[00:10.00] Early word forever\n[00:45.00] Later word forever in chorus";
    const hit = findWordOccurrence("forever", lrc, null, { duration: 180, provider: "itunes" });
    expect(hit).to.not.be.null;
    expect(hit.timestamp).to.equal("0:10");
    expect(hit.in_preview).to.equal(true);
  });

  it("falls back to Deezer mid-preview when no opening-window hit exists", () => {
    const lrc = "[00:45.00] Later word forever in chorus\n[01:20.00] after the bridge";
    const hit = findWordOccurrence("forever", lrc, null, { duration: 180, provider: "deezer" });
    expect(hit).to.not.be.null;
    expect(hit.timestamp).to.equal("0:45");
    expect(hit.in_preview).to.equal(true);
  });

  it("finds a word occurrence in synced lyrics", () => {
    const lrc = "[00:12.00] Tu es mon etoile dans la nuit\n[00:18.00] Brille pour moi";
    const hit = findWordOccurrence("etoile", lrc);
    expect(hit).to.not.be.null;
    expect(hit.snippet).to.contain("etoile");
    expect(hit.timestamp).to.equal("0:12");
    expect(hit.line_index).to.equal(0);
    expect(hit.line_end_ms).to.equal(18000);
  });

  it("caches and retrieves daily words per user/date", () => {
    const payload = { date: "2026-06-14", word: { text: "hola" } };
    saveDailyWord(userId, "2026-06-14", payload);
    const cached = getCachedDailyWord(userId, "2026-06-14");
    expect(cached.word.text).to.equal("hola");
    expect(cached.cached).to.equal(true);
  });

  it("keeps the latest daily word as cache when multiple are saved the same day", () => {
    const date = "2026-06-15";
    saveDailyWord(userId, date, { date, word: { text: "primero" } });
    saveDailyWord(userId, date, { date, word: { text: "segundo" } });
    const cached = getCachedDailyWord(userId, date);
    expect(cached.word.text).to.equal("segundo");
  });

  it("returns all discovered words in recent history", () => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run(userId);
    saveDailyWord(userId, today, {
      date: today,
      word: { text: "amor", translation: "love" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    saveDailyWord(userId, today, {
      date: today,
      word: { text: "noche", translation: "night" },
      song: { id: "2", title: "Song B", artist: "Artist B" },
    });

    const recent = getRecentDailyWords(userId, 7);
    expect(recent).to.have.lengthOf(2);
    expect(recent.map((entry) => entry.word.text)).to.include.members(["amor", "noche"]);
    const withLyric = recent.find((e) => e.word.text === "amor");
    // lyric optional when not stored — smoke that summary shape is stable
    expect(withLyric).to.have.property("lyric");
    expect(withLyric).to.have.property("audio");
  });

  it("returns cached payload without calling AI", async () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      preferred_genre: "pop",
      word: { text: "cached-word", translation: "cached" },
      lyric: { snippet: "line", timestamp: "0:45", timestamp_ms: 45000, line_index: 0, char_start: 0, char_end: 5 },
      song: { id: "1", title: "Song", artist: "Artist", genre: "pop" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30, preview_provider: "deezer" },
    });

    const original = aiService.generateDailyWord;
    aiService.generateDailyWord = async () => { throw new Error("should not call AI"); };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await generateDailyWord(user, { force: false });
    expect(result.word.text).to.equal("cached-word");

    aiService.generateDailyWord = original;
  });

  it("picks vocabulary words from real lyric lines", () => {
    const picked = pickWordFromLyricsHeuristic("El amor y la noche brillan", "easy", new Set());
    expect(picked.word.toLowerCase()).to.be.oneOf(["amor", "noche", "brillan"]);
  });

  it("fixes function-word glosses from the table without calling AI", async () => {
    db.prepare(`
      UPDATE users SET native_language = 'es', target_language = 'en' WHERE id = ?
    `).run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    let aiCalls = 0;
    const original = aiService.glossDailyWords;
    aiService.glossDailyWords = async () => {
      aiCalls += 1;
      throw new Error("should not call AI for a table gloss");
    };
    try {
      const out = await enrichPayloadWordMeta({
        word: { text: "world", translation: "las", pronunciation: "/world/" },
        lyric: { snippet: "around the world" },
      }, user);
      expect(out.word.translation).to.equal("mundo");
      expect(out.word.gloss_v).to.equal(2);
      expect(aiCalls).to.equal(0);
    } finally {
      aiService.glossDailyWords = original;
    }
  });

  it("overwrites software/geometry first-hits with lyric-table senses", async () => {
    db.prepare(`
      UPDATE users SET native_language = 'es', target_language = 'en' WHERE id = ?
    `).run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const cases = [
      { text: "home", translation: "inicio", line: "Why are you sitting at home on the floor?", want: "hogar" },
      { text: "planes", translation: "planos", line: "Jet planes, islands, tigers on a gold leash", want: "aviones" },
      { text: "time", translation: "hora", line: "Tale as old as time", want: "tiempo" },
      { text: "rule", translation: "regla", line: "Let me be your ruler", want: "gobernar" },
      { text: "care", translation: "atención", line: "We don't care", want: "importar" },
      { text: "hand", translation: "cacho", line: "Take my hand", want: "mano" },
      { text: "skin", translation: "máscara", line: "under your skin", want: "piel" },
      { text: "wondering", translation: "maravilla", line: "I was wondering if after all these years", want: "preguntándose" },
    ];
    for (const item of cases) {
      const out = await enrichPayloadWordMeta({
        word: { text: item.text, translation: item.translation, gloss_v: 2 },
        lyric: { snippet: item.line },
      }, user);
      expect(out.word.translation, item.text).to.equal(item.want);
    }
  });

  it("skips clipped slang and artist names when picking lyric words", () => {
    const lyrics = [
      "Holdin' on through the heat",
      "Harry said the waves keep rolling",
      "Holdin' on through the heat",
    ].join("\n");
    const picked = pickWordFromLyricsHeuristic(lyrics, "medium", new Set(), "en", {
      songTitle: "Waves",
      artist: "Harry Styles",
    });
    expect(picked.word.toLowerCase()).to.be.oneOf(["waves", "heat", "rolling", "through", "keep"]);
    expect(picked.word.toLowerCase()).to.not.equal("holdin");
    expect(picked.word.toLowerCase()).to.not.equal("harry");
  });

  it("returns several distinct preview-window candidates without touching the caller's avoid set", () => {
    const preview = [
      "mi corazón late fuerte",
      "la noche brilla sobre el mar",
      "caminamos juntos hasta el amanecer",
    ].join("\n");
    const avoid = new Set(["noche"]);
    const picks = pickWordsFromText(preview, "medium", avoid, "es", { songTitle: "Corazón" }, 3);
    expect(picks.length).to.be.greaterThan(1);
    const words = picks.map((p) => p.word.toLowerCase());
    expect(new Set(words).size).to.equal(words.length);
    expect(words).to.not.include("noche");
    expect([...avoid]).to.deep.equal(["noche"]);
  });

  it("prefers title/hook words that carry meaning in the song", () => {
    const lyrics = [
      "na na na na",
      "oh yeah oh yeah",
      "mi corazón late fuerte",
      "mi corazón late fuerte",
      "mi corazón late fuerte",
    ].join("\n");
    const picked = pickWordFromLyricsHeuristic(lyrics, "medium", new Set(), "es", {
      songTitle: "Mi Corazón",
    });
    expect(picked.word.toLowerCase()).to.equal("corazón");
  });

  it("skips title names and picks a translatable lyric from Hey Jude", () => {
    const lyrics = [
      "Hey Jude, don't make it bad",
      "Take a sad song and make it better",
      "Remember to let her into your heart",
      "Then you can start to make it better",
      "Hey Jude, don't be afraid",
      "You were made to go out and get her",
      "The minute you let her under your skin",
      "Then you begin to make it better",
      "Na na na, na na na na",
    ].join("\n");
    const picked = pickWordFromLyricsHeuristic(lyrics, "medium", new Set(), "en", {
      songTitle: "Hey Jude",
      artist: "The Beatles",
    });
    expect(picked).to.be.ok;
    expect(picked.word.toLowerCase()).to.not.equal("jude");
    expect(picked.word.toLowerCase()).to.be.oneOf([
      "better", "remember", "heart", "afraid", "song", "begin",
    ]);
  });

  it("skips lyric proper names even when they have a name-to-name gloss", () => {
    const lyrics = [
      "Eleanor Rigby picks up the rice",
      "in the church where a wedding has been",
      "Lives in a dream",
      "Waits at the window",
    ].join("\n");
    const picked = pickWordFromLyricsHeuristic(lyrics, "medium", new Set(), "en", {
      songTitle: "Eleanor Rigby",
      artist: "The Beatles",
    });
    expect(picked).to.be.ok;
    expect(["eleanor", "rigby"]).to.not.include(picked.word.toLowerCase());
    expect(picked.word.toLowerCase()).to.be.oneOf([
      "church", "wedding", "dream", "window", "lives", "waits", "picks", "rice",
    ]);
  });

  it("keeps genre fidelity for hip-hop (does not remap to pop)", () => {
    expect(aiService.normalizeGenre("hip-hop")).to.equal("hip-hop");
    expect(aiService.normalizeGenre("hiphop")).to.equal("hip-hop");
    expect(aiService.genresCompatible("hip-hop", "pop")).to.equal(false);
    expect(aiService.genresCompatible("reggaeton", "hip-hop")).to.equal(false);
    expect(aiService.genresCompatible(null, "rock")).to.equal(false);
    expect(aiService.genresCompatible("salsa", "pop")).to.equal(false);
    const verified = aiService.getVerifiedSongCandidates("es", "hip-hop");
    expect(verified.length).to.be.greaterThan(0);
    expect(verified.every((s) => aiService.genresCompatible(s.genre, "hip-hop"))).to.equal(true);
    const rock = aiService.getVerifiedSongCandidates("es", "rock");
    expect(rock.every((s) => s.genre === "rock")).to.equal(true);
  });

  it("does not fall back to curated when verified genre pool is empty", () => {
    // French verified catalog has no hip-hop rows — must stay empty (no pop relabel).
    const verified = aiService.getVerifiedSongCandidates("fr", "hip-hop");
    expect(verified).to.deep.equal([]);
  });

  it("keeps Despacito out of Spanish pop curated picks", () => {
    const curated = aiService.getCuratedSongCandidates("es", "pop");
    const keys = curated.map(
      (s) => `${s.artist.toLowerCase()}|${s.song_title.toLowerCase()}`
    );
    expect(keys).to.not.include("luis fonsi|despacito");
    expect(curated.every((s) => aiService.genresCompatible(s.genre, "pop"))).to.equal(true);
  });

  it("rejects AI songs that only match via forged user genre stamp", async () => {
    const original = aiService.openai.chat.completions.create;
    aiService.openai.chat.completions.create = async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            candidates: [
              { song_title: "Despacito", artist: "Luis Fonsi", genre: "pop" },
              { song_title: "Bailando", artist: "Enrique Iglesias", genre: "pop" },
              { song_title: "Gasolina", artist: "Daddy Yankee", genre: "pop" },
            ],
          }),
        },
      }],
    });
    try {
      const songs = await aiService.generateDailyWordSongs({
        languageName: "Spanish",
        languageCode: "es",
        genre: "pop",
        difficulty: "medium",
      });
      const keys = songs.map(
        (s) => `${s.artist.toLowerCase()}|${s.song_title.toLowerCase()}`
      );
      expect(keys).to.not.include("luis fonsi|despacito");
      expect(keys).to.not.include("daddy yankee|gasolina");
      expect(keys).to.include("enrique iglesias|bailando");
      expect(songs.every((s) => s.genre === "pop")).to.equal(true);
    } finally {
      aiService.openai.chat.completions.create = original;
    }
  });

  it("getCuratedCandidatesForBatch stays inside the requested genre", () => {
    const batch = getCuratedCandidatesForBatch(userId, "es", "rock");
    expect(batch.length).to.be.greaterThan(0);
    expect(batch.every((s) => aiService.genresCompatible(s.genre, "rock"))).to.equal(true);
  });

  it("skips cached daily word when genre no longer matches", () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      preferred_genre: "pop",
      word: { text: "amor", translation: "love" },
      lyric: { snippet: "amor", timestamp: "0:45", timestamp_ms: 45000, line_index: 0, char_start: 0, char_end: 4 },
      song: { id: "1", title: "Song", artist: "Artist", genre: "pop" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    });
    expect(getCachedDailyWord(userId, today, "es", "pop").word.text).to.equal("amor");
    expect(getCachedDailyWord(userId, today, "es", "rock")).to.equal(null);
  });

  it("generates a validated daily word with mocked externals", async () => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("DELETE FROM daily_words WHERE user_id = ? AND date = ?").run(userId, today);

    const restore = stubSongPipeline([{ song_title: "Test Song", artist: "Test Artist", genre: "pop" }]);

    const mockFetch = async (url) => {
      if (url.includes("deezer.com/search")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 999,
              title: "Test Song",
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              artist: { name: "Test Artist" },
            }],
          }),
        };
      }
      if (url.includes("lrclib.net")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            syncedLyrics: "[00:35.00] El amor es fuerte\n[00:42.00] Siempre brilla\n[00:50.00] Para ti",
            plainLyrics: "El amor es fuerte",
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await generateDailyWord(user, { force: true, fetchImpl: mockFetch });

    expect(result.word.text.toLowerCase()).to.be.oneOf([
      "amor", "noche", "brillan", "fuerte", "siempre", "juntos",
    ]);
    expect(result.song.id).to.equal("999");
    expect(result.lyric.snippet.toLowerCase()).to.match(/amor|noche|brillan|fuerte|siempre|juntos/);
    expect(result.audio.preview_url).to.match(/^\/api\/audio\/preview\/999/);
    // One song, one word: extras from the same lyrics stay out of the queue.
    expect(wordQueue.countReady(userId)).to.equal(0);

    restore();
  });

  it("still asks AI for new songs when the unused curated catalog is empty", async () => {
    const pool = getFullSongCandidatePool("es", "pop");
    pool.forEach((song, i) => {
      saveDailyWord(userId, `2026-07-${String((i % 28) + 1).padStart(2, "0")}`, {
        date: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
        word: { text: `usedword${i}` },
        song: { id: String(4000 + i), title: song.song_title, artist: song.artist },
      });
    });
    expect(hasUnusedSongCandidates(userId, "es", "pop")).to.equal(false);
    let aiCalls = 0;
    const original = aiService.generateDailyWordSongs;
    aiService.generateDailyWordSongs = async () => {
      aiCalls += 1;
      return [{ song_title: "Nope", artist: "Nope", genre: "pop" }];
    };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const found = await fetchAiCandidates(user);
    aiService.generateDailyWordSongs = original;
    expect(aiCalls).to.equal(1);
    expect(found).to.deep.equal([{ song_title: "Nope", artist: "Nope", genre: "pop" }]);
  });

  it("generateNextDailyWord skips cooldown when queue is empty", async () => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("DELETE FROM daily_words WHERE user_id = ? AND date = ?").run(userId, today);
    saveDailyWord(userId, today, {
      date: today,
      word: { text: "recent", translation: "recent" },
      song: { id: "1", title: "Song", artist: "Artist" },
    });

    const restore = stubSongPipeline([{ song_title: "Test Song", artist: "Test Artist", genre: "pop" }]);

    const mockFetch = async (url) => {
      if (url.includes("deezer.com/search")) {
        return {
          ok: true,
          json: async () => ({
            data: [{
              id: 501,
              title: "Test Song",
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              rank: 500000,
              artist: { name: "Test Artist" },
            }],
          }),
        };
      }
      if (url.includes("lrclib.net")) {
        return {
          ok: true,
          json: async () => ({
            syncedLyrics: "[00:35.00] Brilla el sol hoy\n[00:42.00] Siempre fuerte\n[00:50.00] Para ti",
            plainLyrics: "Brilla el sol hoy\nSiempre fuerte\nPara ti",
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await generateNextDailyWord(user, mockFetch);

    expect(result.word.text.toLowerCase()).to.be.oneOf(["sol", "brilla", "hoy", "para", "fuerte", "siempre"]);
    restore();
  });

  it("queues remaining validated words from a batch of 5", async () => {
    const mockFetch = async (url) => {
      if (url.includes("deezer.com/search")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 100,
              title: "Test Song",
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              artist: { name: "Test Artist" },
            }],
          }),
        };
      }
      if (url.includes("lrclib.net")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            syncedLyrics: "[00:35.00] El amor y la noche brillan\n[00:42.00] Siempre juntos\n[00:50.00] Para ti",
            plainLyrics: "El amor y la noche brillan",
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const candidates = [
      { song_title: "Test Song", artist: "Test Artist", genre: "pop" },
      { song_title: "Test Song", artist: "Test Artist", genre: "pop" },
    ];

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const originalGloss = aiService.glossDailyWords;
    const originalRefine = aiService.refineGlosses;
    aiService.glossDailyWords = async (items) =>
      items.map((item) => ({
        translation: `${item.word}-en`,
        part_of_speech: "noun",
        pronunciation: "/x/",
      }));
    aiService.refineGlosses = async (items, glosses) =>
      items.map((item, i) => ({
        translation: glosses?.[i]?.translation || `${item.word}-en`,
        part_of_speech: "noun",
        pronunciation: "/x/",
      }));

    const { valid } = await validateAllCandidates(candidates, "2026-06-27", user, mockFetch);
    aiService.glossDailyWords = originalGloss;
    aiService.refineGlosses = originalRefine;
    expect(valid).to.have.lengthOf(1);
    expect(valid[0].word.text.toLowerCase()).to.be.oneOf([
      "amor", "noche", "brillan", "siempre", "juntos", "fuerte",
    ]);

    const inserted = wordQueue.enqueuePayloads(userId, valid.slice(1));
    expect(inserted).to.equal(0);
    expect(wordQueue.countReady(userId)).to.equal(0);
  });

  it("validates multiple songs and picks words from lyrics", async () => {
    const mockFetch = async (url) => {
      if (url.includes("deezer.com/search")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 100,
              title: "Test Song",
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              artist: { name: "Test Artist" },
            }],
          }),
        };
      }
      if (url.includes("lrclib.net")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            syncedLyrics: "[00:35.00] El amor y la noche brillan\n[00:42.00] Siempre juntos\n[00:50.00] Para ti",
            plainLyrics: "El amor y la noche brillan",
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const candidates = [
      { song_title: "Test Song", artist: "Test Artist", genre: "pop" },
    ];

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    user.difficulty = "easy";
    const originalGloss = aiService.glossDailyWords;
    const originalRefine = aiService.refineGlosses;
    aiService.glossDailyWords = async (items) =>
      items.map((item) => ({
        translation: `${item.word}-en`,
        part_of_speech: "noun",
        pronunciation: "/x/",
      }));
    aiService.refineGlosses = async (items, glosses) =>
      items.map((item, i) => ({
        translation: glosses?.[i]?.translation || `${item.word}-en`,
        part_of_speech: "noun",
        pronunciation: "/x/",
      }));

    const { valid } = await validateAllCandidates(candidates, "2026-06-27", user, mockFetch);
    aiService.glossDailyWords = originalGloss;
    aiService.refineGlosses = originalRefine;
    expect(valid).to.have.lengthOf(1);
    expect(valid[0].word.text.toLowerCase()).to.be.oneOf([
      "amor", "noche", "brillan", "siempre", "juntos", "fuerte",
    ]);
  });

  it("prefers target-language words from bilingual lyrics", () => {
    const plain = "screaming in the night\nla mañana es buena";
    const picked = pickWordFromLyricsHeuristic(plain, "medium", new Set(), "es");
    expect(picked.word.toLowerCase()).to.equal("mañana");
  });

  it("skips English queued words for Spanish learners", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const englishPayload = {
      date: today,
      language_code: "es",
      preferred_genre: "pop",
      word: { text: "screaming", translation: "screaming" },
      lyric: { snippet: "screaming", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 9 },
      song: { id: "99", title: "Song", artist: "Artist", genre: "pop" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    };
    const spanishPayload = {
      date: today,
      language_code: "es",
      preferred_genre: "pop",
      word: { text: "tranquila", translation: "calm" },
      lyric: { snippet: "tranquila", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 9 },
      song: { id: "55", title: "Song", artist: "Artist", genre: "pop" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    };
    wordQueue.enqueuePayloads(userId, [englishPayload, spanishPayload]);

    db.prepare("UPDATE users SET target_language = 'es' WHERE id = ?").run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await consumeNextDailyWord(user);
    expect(result).to.not.be.null;
    expect(result.word.text).to.equal("tranquila");
    expect(result.from_queue).to.equal(true);
  });

  it("serves next word instantly from queue", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      date: today,
      language_code: "es",
      preferred_genre: "pop",
      word: { text: "cola", translation: "queue" },
      lyric: { snippet: "cola", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 4 },
      song: { id: "55", title: "Song", artist: "Artist", genre: "pop" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    };
    wordQueue.enqueuePayloads(userId, [payload]);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await consumeNextDailyWord(user);
    expect(result.word.text).to.equal("cola");
    expect(result.from_queue).to.equal(true);
  });

  it("skips duplicate queued words already seen in history", async () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      word: { text: "amor" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    wordQueue.enqueuePayloads(userId, [
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "amor", translation: "love" },
        lyric: { snippet: "amor", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 4 },
        song: { id: "2", title: "Song B", artist: "Artist B", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "noche", translation: "night" },
        lyric: { snippet: "noche", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 5 },
        song: { id: "3", title: "Song C", artist: "Artist C", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
    ]);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await consumeNextDailyWord(user);
    expect(result.word.text).to.equal("noche");
  });

  it("skips queued items that reuse a song already in history", async () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      word: { text: "amor" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    wordQueue.enqueuePayloads(userId, [
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "corazon", translation: "heart" },
        lyric: { snippet: "corazon", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 7 },
        song: { id: "1", title: "Song A", artist: "Artist A", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "noche", translation: "night" },
        lyric: { snippet: "noche", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 5 },
        song: { id: "3", title: "Song C", artist: "Artist C", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
    ]);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await consumeNextDailyWord(user);
    expect(result.word.text).to.equal("noche");
    expect(String(result.song.id)).to.equal("3");
  });

  it("serves another word from the same song when the queue item allows it", async () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      word: { text: "late" },
      song: { id: "99", title: "Heat Waves", artist: "Glass Animals" },
    });
    wordQueue.enqueuePayloads(userId, [
      {
        date: today,
        language_code: "en",
        preferred_genre: "pop",
        allow_same_song: true,
        word: { text: "waves", translation: "olas" },
        lyric: { snippet: "heat waves", timestamp: "0:35", timestamp_ms: 35000, line_index: 0, char_start: 5, char_end: 10 },
        song: { id: "99", title: "Heat Waves", artist: "Glass Animals", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
    ]);
    db.prepare("UPDATE users SET target_language = 'en' WHERE id = ?").run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await consumeNextDailyWord(user);
    expect(result.word.text).to.equal("waves");
    expect(String(result.song.id)).to.equal("99");
  });

  it("keeps validating after the first word so extras can fill the queue", async () => {
    const songFor = (url) => {
      const decoded = decodeURIComponent(url).replace(/\+/g, " ");
      if (decoded.includes("Song Two") || decoded.includes("Artist Two")) {
        return { id: 201, title: "Song Two", artist: "Artist Two", lyrics: "[00:35.00] La noche cae lento\n[00:42.00] Caminamos lejos\n[00:50.00] Para ti" };
      }
      if (decoded.includes("Song Three") || decoded.includes("Artist Three")) {
        return { id: 202, title: "Song Three", artist: "Artist Three", lyrics: "[00:35.00] Quiero verte ahora\n[00:42.00] Bailemos juntos\n[00:50.00] Para ti" };
      }
      if (decoded.includes("Song One") || decoded.includes("Artist One")) {
        return { id: 200, title: "Song One", artist: "Artist One", lyrics: "[00:35.00] El amor brilla fuerte\n[00:42.00] Siempre juntos\n[00:50.00] Para ti" };
      }
      return null;
    };
    const mockFetch = async (url) => {
      if (url.includes("itunes.apple.com")) {
        return { ok: true, status: 200, json: async () => ({ results: [] }) };
      }
      if (url.includes("deezer.com/search")) {
        const song = songFor(url);
        if (!song) {
          return { ok: true, status: 200, json: async () => ({ data: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: song.id,
              title: song.title,
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              artist: { name: song.artist },
            }],
          }),
        };
      }
      if (url.includes("lrclib.net")) {
        const song = songFor(url);
        if (!song) {
          return { ok: true, status: 404, json: async () => ({}) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            syncedLyrics: song.lyrics,
            plainLyrics: song.lyrics.replace(/\[[^\]]+\]\s*/g, ""),
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const restore = stubSongPipeline([]);
    const candidates = [
      { song_title: "Song One", artist: "Artist One", genre: "pop" },
      { song_title: "Song Two", artist: "Artist Two", genre: "pop" },
      { song_title: "Song Three", artist: "Artist Three", genre: "pop" },
    ];
    const { valid, finishBackground } = await validateAllCandidates(
      candidates,
      "2026-09-05",
      user,
      mockFetch,
      { stopAfter: 1 }
    );
    expect(valid).to.have.lengthOf(1);
    expect(finishBackground).to.be.a("function");
    const extras = await finishBackground();
    expect(extras.queued).to.be.at.least(1);
    expect(wordQueue.countReady(userId)).to.be.at.least(1);
    restore();
  });

  it("tracks full discovery history for dedupe", () => {
    saveDailyWord(userId, "2026-06-01", {
      date: "2026-06-01",
      word: { text: "amor" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    const history = getUserDiscoveryHistory(userId);
    expect(history.words.has("amor")).to.equal(true);
    expect(history.songIds.has("1")).to.equal(true);
  });

  it("filterUniquePayloads drops duplicate words and songs", () => {
    saveDailyWord(userId, "2026-06-01", {
      date: "2026-06-01",
      word: { text: "amor" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    const filtered = filterUniquePayloads(userId, [
      { word: { text: "amor" }, song: { id: "2", title: "Song B", artist: "Artist B" } },
      { word: { text: "noche" }, song: { id: "1", title: "Song A", artist: "Artist A" } },
      { word: { text: "luz" }, song: { id: "3", title: "Song C", artist: "Artist C" } },
      { word: { text: "sol" }, song: { id: "3", title: "Song C", artist: "Artist C" } },
    ]);
    expect(filtered).to.have.lengthOf(1);
    expect(filtered[0].word.text).to.equal("luz");
    expect(filtered[0].song.id).to.equal("3");
  });

  it("filterUnusedSongCandidates keeps only unused artist|title keys", () => {
    saveDailyWord(userId, "2026-06-01", {
      date: "2026-06-01",
      word: { text: "amor" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    const fresh = filterUnusedSongCandidates(userId, [
      { artist: "Artist A", song_title: "Song A" },
      { artist: "Artist B", song_title: "Song B" },
    ]);
    expect(fresh).to.have.lengthOf(1);
    expect(fresh[0].song_title).to.equal("Song B");
  });

  it("getCuratedCandidatesForBatch never reintroduces used songs while unused remain", () => {
    const catalog = [
      { artist: "Artist A", song_title: "Song A", genre: "pop" },
      { artist: "Artist B", song_title: "Song B", genre: "pop" },
      { artist: "Artist C", song_title: "Song C", genre: "pop" },
    ];
    const originalCurated = aiService.getCuratedSongCandidates;
    const originalVerified = aiService.getVerifiedSongCandidates;
    aiService.getCuratedSongCandidates = () => catalog;
    aiService.getVerifiedSongCandidates = () => [];
    try {
      saveDailyWord(userId, "2026-06-01", {
        date: "2026-06-01",
        word: { text: "amor" },
        song: { id: "1", title: "Song A", artist: "Artist A" },
      });
      // Even with fewer than 5 fresh songs, used Song A must stay out.
      const batch = getCuratedCandidatesForBatch(userId, "es", "pop");
      const keys = batch.map(
        (c) => `${c.artist.toLowerCase()}|${c.song_title.toLowerCase()}`
      );
      expect(keys).to.not.include("artist a|song a");
      expect(keys.length).to.be.at.least(1);
    } finally {
      aiService.getCuratedSongCandidates = originalCurated;
      aiService.getVerifiedSongCandidates = originalVerified;
    }
  });

  it("limits validation concurrency", () => {
    expect(VALIDATE_CONCURRENCY).to.be.at.least(3).and.at.most(8);
  });

  it("reuses a known song only after unused and widened passes fail", async () => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("DELETE FROM daily_words WHERE user_id = ? AND date = ?").run(userId, today);
    // History already used Deezer id 100 (backdate so force cooldown does not fire)
    saveDailyWord(userId, today, {
      date: today,
      preferred_genre: "pop",
      word: { text: "ayer", translation: "yesterday" },
      song: { id: "100", title: "Old Hit", artist: "Old Artist", genre: "pop" },
      lyric: { snippet: "ayer", timestamp: "0:45", timestamp_ms: 45000, line_index: 0, char_start: 0, char_end: 4 },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    });
    db.prepare(
      "UPDATE daily_words SET generated_at = datetime('now', '-1 day') WHERE user_id = ?"
    ).run(userId);

    const originalCurated = aiService.getCuratedSongCandidates;
    const originalVerified = aiService.getVerifiedSongCandidates;
    // Unused keys remain in the "catalog" so hasUnusedSongCandidates stays true
    aiService.getCuratedSongCandidates = () => [
      { artist: "Fresh Artist", song_title: "Fresh Unused", genre: "pop" },
      { artist: "Test Artist", song_title: "Test Song", genre: "pop" },
    ];
    aiService.getVerifiedSongCandidates = () => [];
    const restore = stubSongPipeline([
      { song_title: "Test Song", artist: "Test Artist", genre: "pop" },
    ]);

    const mockFetch = async (url) => {
      if (url.includes("deezer.com/search")) {
        // Every search resolves to the already-used Deezer id — unused pass fails with song_already_used
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 100,
              title: "Test Song",
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              artist: { name: "Test Artist" },
            }],
          }),
        };
      }
      if (url.includes("lrclib.net")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            syncedLyrics: "[00:35.00] El amor es fuerte\n[00:42.00] Siempre brilla\n[00:50.00] Para ti",
            plainLyrics: "El amor es fuerte\nSiempre brilla\nPara ti",
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    try {
      const result = await generateDailyWord(user, { force: true, fetchImpl: mockFetch });
      expect(result.word.text).to.be.a("string").and.not.empty;
      expect(String(result.song.id)).to.equal("100");
    } finally {
      restore();
      aiService.getCuratedSongCandidates = originalCurated;
      aiService.getVerifiedSongCandidates = originalVerified;
    }
  });

  it("payloadMatchesUserGenre accepts style_relaxed only for the widened-from style", () => {
    const { payloadMatchesUserGenre } = require("./dailyWordService");
    const payload = {
      style_relaxed: true,
      style_relaxed_from: "rock",
      song: { genre: "pop" },
      preferred_genre: "pop",
    };
    expect(payloadMatchesUserGenre(payload, "rock")).to.equal(true);
    expect(payloadMatchesUserGenre(payload, "hip-hop")).to.equal(false);
  });

  it("purgeQueueWrongLanguage discards FR queue items when target is DE", () => {
    wordQueue.enqueuePayloads(userId, [
      {
        date: "2026-07-09",
        language_code: "fr",
        word: { text: "seulement", translation: "only" },
        song: { id: "10", title: "FR Song", artist: "Artist" },
        lyric: { snippet: "seulement", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 9 },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
      {
        date: "2026-07-09",
        language_code: "de",
        word: { text: "Männer", translation: "men" },
        song: { id: "11", title: "DE Song", artist: "Artist" },
        lyric: { snippet: "Männer", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 6 },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
    ]);
    expect(wordQueue.countReady(userId)).to.equal(2);
    purgeQueueWrongLanguage(userId, "de");
    expect(wordQueue.countReady(userId)).to.equal(1);
    expect(wordQueue.peekNext(userId).payload.word.text).to.equal("Männer");
  });

  for (const [code, name] of [
    ['pt', 'Portuguese'],
    ['de', 'German'],
    ['en', 'English'],
    ['fr', 'French'],
    ['es', 'Spanish'],
    ['it', 'Italian'],
  ]) {
    it(`passes ${name} to AI for target_language=${code}`, async () => {
      db.prepare('UPDATE users SET target_language = ? WHERE id = ?').run(code, userId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      let capturedLanguage;
      const originalSongs = aiService.generateDailyWordSongs;
      try {
        aiService.generateDailyWordSongs = async (args) => {
          capturedLanguage = args.languageName;
          return [{ song_title: "Song", artist: "Artist", genre: "pop" }];
        };
        await fetchAiCandidates(user);
        expect(capturedLanguage).to.equal(name);
      } finally {
        aiService.generateDailyWordSongs = originalSongs;
      }
    });
  }

  it('boosts candidate songs matching user top Spotify artists', () => {
    const spotifyProfileService = require('./spotifyProfileService');
    const db = require('../db');
    const testUserId = 'test-spotify-user-' + Date.now();
    db.prepare('INSERT INTO users (id, email, password_hash, native_language, target_language, genre) VALUES (?, ?, ?, ?, ?, ?)').run(
      testUserId, `spotify-${Date.now()}@test.com`, 'hash', 'en', 'es', 'reggaeton'
    );
    db.prepare('INSERT INTO user_spotify_profiles (user_id, top_genres_json, top_artists_json, last_synced_at) VALUES (?, ?, ?, ?)').run(
      testUserId, JSON.stringify(['reggaeton']), JSON.stringify(['Bad Bunny']), new Date().toISOString()
    );

    const candidates = getCuratedCandidatesForBatch(testUserId, 'es', 'reggaeton');
    expect(candidates.length).to.be.greaterThan(0);
    expect(candidates[0].artist.toLowerCase()).to.equal('bad bunny');
  });

  it("does not reuse a used Deezer id while unused catalog keys remain", async () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      preferred_genre: "pop",
      word: { text: "ayer", translation: "yesterday" },
      song: { id: "100", title: "Old Hit", artist: "Old Artist", genre: "pop" },
      lyric: { snippet: "ayer", timestamp: "0:45", timestamp_ms: 45000, line_index: 0, char_start: 0, char_end: 4 },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    });

    const originalCurated = aiService.getCuratedSongCandidates;
    const originalVerified = aiService.getVerifiedSongCandidates;
    aiService.getCuratedSongCandidates = () => [
      { artist: "Fresh Artist", song_title: "Fresh Unused", genre: "pop" },
    ];
    aiService.getVerifiedSongCandidates = () => [];
    const restore = stubSongPipeline([
      { song_title: "Fresh Unused", artist: "Fresh Artist", genre: "pop" },
    ]);

    const mockFetch = async (url) => {
      if (String(url).includes("itunes.apple.com")) {
        return { ok: true, status: 200, json: async () => ({ results: [] }) };
      }
      if (String(url).includes("deezer.com/search")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 100,
              title: "Fresh Unused",
              duration: 200,
              preview: "https://cdn.example/preview.mp3",
              artist: { name: "Fresh Artist" },
            }],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    try {
      const result = await generateValidatedBatch(user, mockFetch, { stopAfter: 1 });
      expect(result.valid).to.have.lengthOf(0);
      expect(result.lastError).to.equal("song_already_used");
    } finally {
      restore();
      aiService.getCuratedSongCandidates = originalCurated;
      aiService.getVerifiedSongCandidates = originalVerified;
    }
  });

  it("pickNextQueueItem skips the last song when another song is ready", () => {
    const today = new Date().toISOString().slice(0, 10);
    wordQueue.enqueuePayloads(userId, [
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "town", translation: "pueblo" },
        lyric: { snippet: "torn up town", timestamp: "0:14", timestamp_ms: 14000, line_index: 0, char_start: 8, char_end: 12 },
        song: { id: "royals", title: "Royals", artist: "Lorde", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "luz", translation: "light" },
        lyric: { snippet: "luz", timestamp: "0:20", timestamp_ms: 20000, line_index: 0, char_start: 0, char_end: 3 },
        song: { id: "other", title: "Other Song", artist: "Other Artist", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
    ]);
    const picked = pickNextQueueItem(userId, "royals");
    expect(picked.payload.word.text).to.equal("luz");
    expect(String(picked.payload.song.id)).to.equal("other");
  });

  it("queueSameSongFallback marks extras as last-resort same-song items", async () => {
    const today = new Date().toISOString().slice(0, 10);
    saveDailyWord(userId, today, {
      date: today,
      language_code: "en",
      preferred_genre: "pop",
      word: { text: "royals", translation: "realeza" },
      song: { id: "404", title: "Royals", artist: "Lorde", genre: "pop" },
      lyric: { snippet: "And we'll never be royals", timestamp: "0:14", timestamp_ms: 14000, line_index: 0, char_start: 18, char_end: 24 },
      audio: { preview_url: "http://x", duration_seconds: 190, preview_offset: 30, preview_provider: "deezer" },
    });
    db.prepare(`
      INSERT OR REPLACE INTO song_lyrics_snapshot (song_id, synced_lyrics, plain_lyrics)
      VALUES (?, ?, ?)
    `).run(
      "404",
      "[00:08.00] I've never seen a diamond in the flesh\n[00:14.00] I cut my teeth on wedding rings in the movies\n[00:20.00] And I'm not proud of my address\n[00:26.00] In a torn up town, no postcode envy",
      "I've never seen a diamond in the flesh\nI cut my teeth on wedding rings in the movies\nAnd I'm not proud of my address\nIn a torn up town, no postcode envy"
    );
    db.prepare("UPDATE users SET target_language = 'en' WHERE id = ?").run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const inserted = await queueSameSongFallback(user, fetch, { maxWords: 2 });
    expect(inserted).to.be.at.least(1);
    const item = wordQueue.peekNext(userId);
    expect(item.payload.allow_same_song).to.equal(true);
    expect(item.payload.same_song_fallback).to.equal(true);
    expect(String(item.payload.song.id)).to.equal("404");
    expect(String(item.payload.word.text).toLowerCase()).to.not.equal("royals");
  });

  it("getRecentArtists lists newest distinct artists first", () => {
    saveDailyWord(userId, "2026-09-01", {
      date: "2026-09-01",
      word: { text: "one" },
      song: { id: "1", title: "A", artist: "Lorde" },
    });
    saveDailyWord(userId, "2026-09-02", {
      date: "2026-09-02",
      word: { text: "two" },
      song: { id: "2", title: "B", artist: "Glass Animals" },
    });
    saveDailyWord(userId, "2026-09-03", {
      date: "2026-09-03",
      word: { text: "three" },
      song: { id: "3", title: "C", artist: "Lorde" },
    });
    expect(getRecentArtists(userId, 2)).to.deep.equal(["Lorde", "Glass Animals"]);
  });

  it("fetchAiCandidates forwards recent artists so the prompt prefers new voices", async () => {
    saveDailyWord(userId, "2026-09-03", {
      date: "2026-09-03",
      word: { text: "waves" },
      song: { id: "9", title: "Heat Waves", artist: "Glass Animals" },
    });
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    let captured;
    const originalSongs = aiService.generateDailyWordSongs;
    try {
      aiService.generateDailyWordSongs = async (args) => {
        captured = args;
        return [];
      };
      await fetchAiCandidates(user);
      expect(captured.avoidArtists).to.include("Glass Animals");
    } finally {
      aiService.generateDailyWordSongs = originalSongs;
    }
  });

  it("filterUniquePayloads keeps same-song extras only when they opt in", () => {
    saveDailyWord(userId, "2026-06-01", {
      date: "2026-06-01",
      word: { text: "amor" },
      song: { id: "1", title: "Song A", artist: "Artist A" },
    });
    const blocked = filterUniquePayloads(userId, [
      { word: { text: "noche" }, song: { id: "1", title: "Song A", artist: "Artist A" } },
    ]);
    expect(blocked).to.have.lengthOf(0);
    const allowed = filterUniquePayloads(userId, [
      { word: { text: "noche" }, song: { id: "1", title: "Song A", artist: "Artist A" }, allow_same_song: true },
    ]);
    expect(allowed).to.have.lengthOf(1);
    expect(allowed[0].word.text).to.equal("noche");
  });

  it("treats stem-derived dictionary hits as provisional glosses", async () => {
    db.prepare(`
      UPDATE users SET native_language = 'es', target_language = 'en' WHERE id = ?
    `).run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const out = await enrichPayloadWordMeta({
      word: { text: "waited", translation: null, gloss_v: 1 },
      lyric: { snippet: "I waited for you" },
    }, user);
    expect(out.word.translation).to.equal("esperar");
    expect(out.word.gloss_v).to.equal(1);
  });
});
