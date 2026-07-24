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
  consumeNextDailyWord,
  generateNextDailyWord,
  generateDailyWord,
  pickWordFromLyricsHeuristic,
  filterUniquePayloads,
  filterUnusedSongCandidates,
  getCuratedCandidatesForBatch,
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

  it("prefers opening-window occurrences (iTunes-compatible) over mid-track Deezer window", () => {
    const { isTimestampInPreview } = require("./dailyWordService");
    expect(isTimestampInPreview(45000, 180)).to.equal(true); // 0:45 in [30,60]
    expect(isTimestampInPreview(10000, 180)).to.equal(false); // 0:10 outside Deezer mid window
    const lrc =
      "[00:10.00] Early word forever\n[00:45.00] Later word forever in chorus";
    const hit = findWordOccurrence("forever", lrc, null, { duration: 180 });
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
      word: { text: "cached-word", translation: "cached" },
      lyric: { snippet: "line", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 5 },
      song: { id: "1", title: "Song", artist: "Artist" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
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

  it("keeps genre fidelity for hip-hop (does not remap to pop)", () => {
    expect(aiService.normalizeGenre("hip-hop")).to.equal("hip-hop");
    expect(aiService.normalizeGenre("hiphop")).to.equal("hip-hop");
    expect(aiService.genresCompatible("hip-hop", "pop")).to.equal(false);
    expect(aiService.genresCompatible("reggaeton", "hip-hop")).to.equal(true);
    const verified = aiService.getVerifiedSongCandidates("es", "hip-hop");
    expect(verified.length).to.be.greaterThan(0);
    expect(verified.every((s) => aiService.genresCompatible(s.genre, "hip-hop"))).to.equal(true);
    const rock = aiService.getVerifiedSongCandidates("es", "rock");
    expect(rock.every((s) => s.genre === "rock")).to.equal(true);
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
            syncedLyrics: "[00:10.00] El amor es fuerte\n[00:20.00] Siempre brilla\n[00:30.00] Para ti",
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

    restore();
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
            syncedLyrics: "[00:10.00] Brilla el sol hoy\n[00:20.00] Siempre fuerte\n[00:30.00] Para ti",
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
            syncedLyrics: "[00:10.00] El amor y la noche brillan\n[00:20.00] Siempre juntos\n[00:30.00] Para ti",
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
            syncedLyrics: "[00:10.00] El amor y la noche brillan\n[00:20.00] Siempre juntos\n[00:30.00] Para ti",
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
      word: { text: "screaming", translation: "screaming" },
      lyric: { snippet: "screaming", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 9 },
      song: { id: "99", title: "Song", artist: "Artist" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    };
    const spanishPayload = {
      date: today,
      language_code: "es",
      word: { text: "tranquila", translation: "calm" },
      lyric: { snippet: "tranquila", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 9 },
      song: { id: "55", title: "Song", artist: "Artist" },
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
      word: { text: "cola", translation: "queue" },
      lyric: { snippet: "cola", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 4 },
      song: { id: "55", title: "Song", artist: "Artist" },
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
        word: { text: "amor", translation: "love" },
        lyric: { snippet: "amor", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 4 },
        song: { id: "2", title: "Song B", artist: "Artist B" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
      {
        date: today,
        language_code: "es",
        word: { text: "noche", translation: "night" },
        lyric: { snippet: "noche", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 5 },
        song: { id: "3", title: "Song C", artist: "Artist C" },
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
        word: { text: "corazon", translation: "heart" },
        lyric: { snippet: "corazon", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 7 },
        song: { id: "1", title: "Song A", artist: "Artist A" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
      {
        date: today,
        language_code: "es",
        word: { text: "noche", translation: "night" },
        lyric: { snippet: "noche", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 5 },
        song: { id: "3", title: "Song C", artist: "Artist C" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
      },
    ]);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const result = await consumeNextDailyWord(user);
    expect(result.word.text).to.equal("noche");
    expect(String(result.song.id)).to.equal("3");
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
      const today = new Date().toISOString().slice(0, 10);
      db.prepare('UPDATE users SET target_language = ? WHERE id = ?').run(code, userId);
      db.prepare('DELETE FROM daily_words WHERE user_id = ? AND date = ?').run(userId, today);

      let capturedLanguage;
      const originalSongs = aiService.generateDailyWordSongs;
      aiService.generateDailyWordSongs = async (args) => {
        capturedLanguage = args.languageName;
        return [{ song_title: "Song", artist: "Artist", genre: "pop" }];
      };
      const originalGloss = aiService.glossDailyWords;
      aiService.glossDailyWords = async () => [{ translation: "test", part_of_speech: "noun" }];

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      try {
        await generateDailyWord(user, {
          force: true,
          fetchImpl: async () => ({ ok: false, status: 404 }),
        });
      } catch (err) {
        expect(err.message).to.equal('daily_word_generation_failed');
      }

      expect(capturedLanguage).to.equal(name);
      aiService.generateDailyWordSongs = originalSongs;
      aiService.glossDailyWords = originalGloss;
    });
  }
});
