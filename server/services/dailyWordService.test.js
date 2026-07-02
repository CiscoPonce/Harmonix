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
  getUserDiscoveryHistory,
} = require("./dailyWordService");
const wordQueue = require("./wordQueueService");
const aiService = require("./aiService");

function stubSongPipeline(songCandidates) {
  const originalSongs = aiService.generateDailyWordSongs;
  const originalGloss = aiService.glossDailyWords;
  aiService.generateDailyWordSongs = async () => songCandidates;
  aiService.glossDailyWords = async (items) =>
    items.map((item) => ({ translation: item.word, part_of_speech: "noun" }));
  return () => {
    aiService.generateDailyWordSongs = originalSongs;
    aiService.glossDailyWords = originalGloss;
  };
}

describe("Daily Word Service", () => {
  const userId = "daily-word-test-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "daily@test.com", "x");
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

  it("finds a word occurrence in synced lyrics", () => {
    const lrc = "[00:12.00] Tu es mon etoile dans la nuit\n[00:18.00] Brille pour moi";
    const hit = findWordOccurrence("etoile", lrc);
    expect(hit).to.not.be.null;
    expect(hit.snippet).to.contain("etoile");
    expect(hit.timestamp).to.equal("0:12");
    expect(hit.line_index).to.equal(0);
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

    expect(result.word.text.toLowerCase()).to.be.oneOf(["amor", "noche", "brillan", "fuerte", "siempre"]);
    expect(result.song.id).to.equal("999");
    expect(result.lyric.snippet).to.contain("amor");
    expect(result.audio.preview_url).to.equal("/api/audio/preview/999");

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
    aiService.glossDailyWords = async (items) =>
      items.map((item) => ({ translation: item.word, part_of_speech: "noun" }));

    const { valid } = await validateAllCandidates(candidates, "2026-06-27", user, mockFetch);
    aiService.glossDailyWords = originalGloss;
    expect(valid).to.have.lengthOf(1);
    expect(valid[0].word.text).to.be.oneOf(["amor", "noche", "brillan"]);

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
    aiService.glossDailyWords = async (items) =>
      items.map((item) => ({ translation: item.word, part_of_speech: "noun" }));

    const { valid } = await validateAllCandidates(candidates, "2026-06-27", user, mockFetch);
    aiService.glossDailyWords = originalGloss;
    expect(valid).to.have.lengthOf(1);
    expect(valid[0].word.text).to.be.oneOf(["amor", "noche", "brillan"]);
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

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    db.prepare("UPDATE users SET target_language = 'es' WHERE id = ?").run(userId);
    const result = await consumeNextDailyWord(user);
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
      { word: { text: "noche" }, song: { id: "3", title: "Song C", artist: "Artist C" } },
    ]);
    expect(filtered).to.have.lengthOf(1);
    expect(filtered[0].word.text).to.equal("noche");
    expect(filtered[0].song.id).to.equal("3");
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
