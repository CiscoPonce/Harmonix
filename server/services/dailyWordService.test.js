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
  generateDailyWord,
} = require("./dailyWordService");
const wordQueue = require("./wordQueueService");
const aiService = require("./aiService");

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

  it("generates a validated daily word with mocked externals", async () => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("DELETE FROM daily_words WHERE user_id = ? AND date = ?").run(userId, today);

    const originalAi = aiService.generateDailyWord;
    aiService.generateDailyWord = async () => ({
      target_word: "amor",
      translation: "love",
      part_of_speech: "noun",
      difficulty: "medium",
      song_title: "Test Song",
      artist: "Test Artist",
      genre: "pop",
    });

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

    expect(result.word.text).to.equal("amor");
    expect(result.song.id).to.equal("999");
    expect(result.lyric.snippet).to.contain("amor");
    expect(result.audio.preview_url).to.equal("/api/audio/preview/999");

    aiService.generateDailyWord = originalAi;
  });

  it("validates all AI candidates and can enqueue multiple valid words", async () => {
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
      { target_word: "amor", translation: "love", song_title: "Test Song", artist: "Test Artist", genre: "pop" },
      { target_word: "noche", translation: "night", song_title: "Test Song", artist: "Test Artist", genre: "pop" },
    ];

    const { valid } = await validateAllCandidates(candidates, "2026-06-27", "pop", "medium", "B1", mockFetch);
    expect(valid).to.have.lengthOf(2);
    expect(valid.map((p) => p.word.text)).to.include.members(["amor", "noche"]);

    const inserted = wordQueue.enqueuePayloads(userId, valid.slice(1));
    expect(inserted).to.equal(1);
    expect(wordQueue.countReady(userId)).to.equal(1);
  });

  it("prefers easy-matched candidates when user difficulty is easy", async () => {
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
      { target_word: "noche", translation: "night", difficulty: "hard", cefr_level: "C1", song_title: "Test Song", artist: "Test Artist", genre: "pop" },
      { target_word: "amor", translation: "love", difficulty: "easy", cefr_level: "A1", song_title: "Test Song", artist: "Test Artist", genre: "pop" },
    ];

    const { valid } = await validateAllCandidates(candidates, "2026-06-27", "pop", "easy", "B1", mockFetch);
    expect(valid).to.have.lengthOf(2);
    expect(valid[0].word.text).to.equal("amor");
  });

  it("serves next word instantly from queue", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      date: today,
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

  for (const [code, name] of [
    ['pt', 'Portuguese'],
    ['de', 'German'],
    ['en', 'English'],
    ['fr', 'French'],
    ['es', 'Spanish'],
  ]) {
    it(`passes ${name} to AI for target_language=${code}`, async () => {
      const today = new Date().toISOString().slice(0, 10);
      db.prepare('UPDATE users SET target_language = ? WHERE id = ?').run(code, userId);
      db.prepare('DELETE FROM daily_words WHERE user_id = ? AND date = ?').run(userId, today);

      let capturedLanguage;
      const originalAi = aiService.generateDailyWord;
      aiService.generateDailyWord = async (args) => {
        capturedLanguage = args.languageName;
        return [{
          target_word: 'teste',
          translation: 'test',
          song_title: 'Song',
          artist: 'Artist',
          genre: 'pop',
        }];
      };

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
      aiService.generateDailyWord = originalAi;
    });
  }
});
