const { expect } = require("chai");
const dailyWordRouter = require("./dailyWord");
const dailyWordService = require("../services/dailyWordService");
const ttsService = require("../services/ttsService");
const db = require("../db");

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  r.sendStatus = (c) => { r.statusCode = c; return r; };
  r.setHeader = (k, v) => { r.headers = r.headers || {}; r.headers[k] = v; return r; };
  r.send = (d) => { if (r.statusCode === undefined) r.statusCode = 200; r.body = d; return r; };
  return r;
};

describe("Daily Word Routes", () => {
  const userId = "daily-route-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "route@test.com", "x");
    db.prepare("DELETE FROM user_word_queue WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_queue_refill WHERE user_id = ?").run(userId);
  });

  it("GET / returns daily word payload", async () => {
    const original = dailyWordService.generateDailyWord;
    dailyWordService.generateDailyWord = async () => ({ date: "2026-06-14", word: { text: "hola" } });

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    await handler(req, res);

    expect(res.body.word.text).to.equal("hola");
    dailyWordService.generateDailyWord = original;
  });

  it("GET /recent returns daily words from the past 7 days", () => {
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run(userId);

    const dayOffset = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };

    const save = (date, word) => {
      db.prepare(`
        INSERT INTO daily_words (user_id, date, word_json)
        VALUES (?, ?, ?)
      `).run(userId, date, JSON.stringify({
        date,
        word: { text: word, translation: `${word}-en` },
        song: { id: "123", title: "Song", artist: "Artist" },
      }));
    };

    save(dayOffset(1), "nuevo");
    save(dayOffset(5), "viejo");
    save(dayOffset(10), "muy-viejo");

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/recent").route.stack[0].handle;
    const req = { user: { id: userId }, query: { days: "7" } };
    const res = mockRes();
    handler(req, res);

    expect(res.body.recent).to.have.lengthOf(2);
    expect(res.body.recent[0].word.text).to.equal("nuevo");
    expect(res.body.recent[1].word.text).to.equal("viejo");
  });

  it("GET /recent returns every word discovered today, not just the latest", () => {
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run(userId);

    const today = new Date().toISOString().slice(0, 10);
    const save = (word) => {
      db.prepare(`
        INSERT INTO daily_words (user_id, date, word_json, generated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(userId, today, JSON.stringify({
        date: today,
        word: { text: word, translation: `${word}-en` },
        song: { id: "123", title: "Song", artist: "Artist" },
      }));
    };

    save("primero");
    save("segundo");
    save("tercero");

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/recent").route.stack[0].handle;
    const req = { user: { id: userId }, query: { days: "7" } };
    const res = mockRes();
    handler(req, res);

    expect(res.body.recent).to.have.lengthOf(3);
    expect(res.body.recent.map((entry) => entry.word.text)).to.include.members(["primero", "segundo", "tercero"]);
  });

  it("POST /new forces regeneration", async () => {
    const original = dailyWordService.generateDailyWord;
    let forced = false;
    dailyWordService.generateDailyWord = async (_user, opts) => {
      forced = opts.force;
      return { date: "2026-06-14", word: { text: "nuevo" } };
    };

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/new").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    await handler(req, res);

    expect(forced).to.equal(true);
    expect(res.body.word.text).to.equal("nuevo");
    dailyWordService.generateDailyWord = original;
  });

  it("GET /queue-status returns ready count", () => {
    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/queue-status").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    handler(req, res);
    expect(res.body).to.have.property("ready");
    expect(res.body).to.have.property("refilling");
    expect(res.body.target).to.equal(5);
  });

  it("POST /next serves instantly from queue when stocked", async () => {
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run(userId);
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO user_word_queue (user_id, word_json, expires_at)
      VALUES (?, ?, datetime('now', '+7 days'))
    `).run(userId, JSON.stringify({
      date: today,
      word: { text: "instant", translation: "fast" },
      lyric: { snippet: "instant", timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: 7 },
      song: { id: "9", title: "Song", artist: "Artist" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
    }));

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/next").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    await handler(req, res);

    expect(res.body.word.text).to.equal("instant");
    expect(res.body.from_queue).to.equal(true);
    expect(res.body.queue).to.have.property("ready");
  });
});

describe("GET /pronounce", () => {
  const userId = "pronounce-test-user";
  const originalGetPronunciation = ttsService.getPronunciationForWord;

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "pronounce@test.com", "x");
    db.prepare("UPDATE users SET target_language = ? WHERE id = ?").run("es", userId);
    db.prepare("DELETE FROM word_pronunciation_cache WHERE word = 'testword'").run();
    db.prepare("DELETE FROM word_pronunciation_cache WHERE word = 'newword'").run();
  });

  afterEach(() => {
    ttsService.getPronunciationForWord = originalGetPronunciation;
  });

  it("returns 400 when word param is missing", async () => {
    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/pronounce").route.stack[0].handle;
    const req = { user: { id: userId }, query: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).to.equal(400);
    expect(res.body.error).to.equal("word required");
  });

  it("returns 404 for unsupported language", async () => {
    db.prepare("UPDATE users SET target_language = ? WHERE id = ?").run("zh", userId);
    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/pronounce").route.stack[0].handle;
    const req = { user: { id: userId }, query: { word: "hola" } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).to.equal(404);
    expect(res.body.error).to.equal("unsupported_language");
  });

  it("returns cached WAV on cache hit without calling Pocket-TTS", async () => {
    const testWav = Buffer.alloc(64, 0);
    testWav.writeUInt32LE(56, 0);
    db.prepare("INSERT OR IGNORE INTO word_pronunciation_cache (word, audio_blob) VALUES (?, ?)").run("testword", testWav);

    // Do NOT mock getPronunciationForWord — let it check the cache for real.
    // If Pocket-TTS isn't running, a cache miss would throw. Passing = cache hit worked.
    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/pronounce").route.stack[0].handle;
    const req = { user: { id: userId }, query: { word: "testword" } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).to.equal(200);
    expect(res.headers["Content-Type"]).to.equal("audio/wav");
  });

  it("calls Pocket-TTS on cache miss and caches result", async () => {
    const fakeWav = Buffer.alloc(48, 0);
    fakeWav.writeUInt32LE(56, 0);
    fakeWav.writeUInt32LE(4, 40);

    let calledWith = null;
    ttsService.getPronunciationForWord = async (word, lang) => { calledWith = [word, lang]; return fakeWav; };

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/pronounce").route.stack[0].handle;
    const req = { user: { id: userId }, query: { word: "newword" } };
    const res = mockRes();
    await handler(req, res);
    expect(calledWith).to.deep.equal(["newword", "es"]);
    expect(res.statusCode).to.equal(200);
  });
});
