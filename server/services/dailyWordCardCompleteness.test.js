/**
 * Scorecard for the thin-card fix: Android/web must get meaning + IPA
 * on Next without waiting on a live model call.
 */
const { expect } = require("chai");
const db = require("../db");
const wordQueue = require("./wordQueueService");
const glossCache = require("./glossCacheService");
const aiService = require("./aiService");
const {
  generateNextDailyWord,
  generateDailyWord,
  enrichIfNeeded,
  cardPresentationReady,
  shouldBackgroundPolish,
  polishQueuedPayload,
  attachCachedWordMeta,
} = require("./dailyWordService");

function cardScore(word) {
  const meaning = Boolean(String(word?.translation || "").trim())
    && String(word.translation).toLowerCase() !== String(word?.text || "").toLowerCase();
  const ipa = Boolean(String(word?.pronunciation || "").trim());
  return { meaning, ipa, complete: meaning && ipa };
}

describe("Daily word card completeness", () => {
  const userId = "card-complete-test-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
      userId,
      "card-complete@test.com",
      "x"
    );
    db.prepare(`
      UPDATE users
      SET native_language = 'en', target_language = 'es', genre = 'pop', difficulty = 'medium'
      WHERE id = ?
    `).run(userId);
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_word_queue WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_queue_refill WHERE user_id = ?").run(userId);
    db.exec("DELETE FROM gloss_cache");
  });

  it("treats a translation-only card as incomplete (the old Android blank IPA case)", () => {
    const thin = { text: "luz", translation: "light", gloss_v: 2 };
    expect(cardPresentationReady(thin)).to.equal(false);
    expect(shouldBackgroundPolish(thin)).to.equal(true);
    expect(cardScore(thin).complete).to.equal(false);
  });

  it("treats translation + IPA as ready to show on Android and web", () => {
    const ready = { text: "luz", translation: "light", pronunciation: "/lus/", gloss_v: 2 };
    expect(cardPresentationReady(ready)).to.equal(true);
    expect(shouldBackgroundPolish(ready)).to.equal(false);
    expect(cardScore(ready).complete).to.equal(true);
  });

  it("Next skips a thin FIFO card when a complete card is already queued", async () => {
    const today = new Date().toISOString().slice(0, 10);
    wordQueue.enqueuePayloads(userId, [
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "town", translation: "pueblo", gloss_v: 2 },
        lyric: { snippet: "torn up town", timestamp: "0:14", timestamp_ms: 14000, line_index: 0, char_start: 8, char_end: 12 },
        song: { id: "thin-song", title: "Thin", artist: "A", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30, preview_provider: "deezer" },
      },
      {
        date: today,
        language_code: "es",
        preferred_genre: "pop",
        word: { text: "luz", translation: "light", pronunciation: "/lus/", gloss_v: 2 },
        lyric: { snippet: "luz", timestamp: "0:20", timestamp_ms: 20000, line_index: 0, char_start: 0, char_end: 3 },
        song: { id: "ready-song", title: "Ready", artist: "B", genre: "pop" },
        audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30, preview_provider: "deezer" },
      },
    ]);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    let aiCalls = 0;
    const original = aiService.glossDailyWords;
    aiService.glossDailyWords = async () => {
      aiCalls += 1;
      throw new Error("Next must not block on AI when a complete card is queued");
    };
    try {
      const out = await generateNextDailyWord(user);
      expect(out.word.text).to.equal("luz");
      expect(out.from_queue).to.equal(true);
      expect(cardScore(out.word).complete).to.equal(true);
      expect(aiCalls).to.equal(0);
    } finally {
      aiService.glossDailyWords = original;
    }
  });

  it("GET of today's cached card attaches IPA from the gloss cache instantly", async () => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO daily_words (user_id, date, word_json)
      VALUES (?, ?, ?)
    `).run(userId, today, JSON.stringify({
      date: today,
      language_code: "es",
      preferred_genre: "pop",
      word: { text: "noche", translation: "night", gloss_v: 2 },
      lyric: { snippet: "esta noche", timestamp: "0:45", timestamp_ms: 45000, line_index: 0, char_start: 5, char_end: 10 },
      song: { id: "1", title: "Song", artist: "Artist", genre: "pop" },
      audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30, preview_provider: "deezer" },
    }));
    glossCache.rememberGloss("noche", "es", "en", "night", "ai", {
      pronunciation: "/ˈno.tʃe/",
      part_of_speech: "noun",
    });
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    let aiCalls = 0;
    const original = aiService.glossDailyWords;
    aiService.glossDailyWords = async () => {
      aiCalls += 1;
      throw new Error("cached IPA must not call the models");
    };
    try {
      const out = await generateDailyWord(user, { force: false });
      expect(out.word.text).to.equal("noche");
      expect(out.word.pronunciation).to.equal("/ˈno.tʃe/");
      expect(out.word.part_of_speech).to.equal("noun");
      expect(cardScore(out.word).complete).to.equal(true);
      expect(aiCalls).to.equal(0);
    } finally {
      aiService.glossDailyWords = original;
    }
  });

  it("queue polish fills IPA from cache without a model call", async () => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    glossCache.rememberGloss("ola", "es", "en", "wave", "ai", {
      pronunciation: "/o.la/",
      part_of_speech: "noun",
    });
    let aiCalls = 0;
    const original = aiService.glossDailyWords;
    aiService.glossDailyWords = async () => {
      aiCalls += 1;
      throw new Error("cache-complete polish must not call AI");
    };
    try {
      const out = await polishQueuedPayload({
        word: { text: "ola", translation: "wave", gloss_v: 2 },
        lyric: { snippet: "una ola enorme" },
      }, user);
      expect(out.word.pronunciation).to.equal("/o.la/");
      expect(cardScore(out.word).complete).to.equal(true);
      expect(aiCalls).to.equal(0);
    } finally {
      aiService.glossDailyWords = original;
    }
  });

  it("attachCachedWordMeta never invents a meaning or IPA", () => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const out = attachCachedWordMeta({
      word: { text: "zxqunknownword", translation: null },
      lyric: { snippet: "zxqunknownword in a line" },
    }, user);
    expect(out.word.translation == null || out.word.translation === "").to.equal(true);
    expect(out.word.pronunciation == null || out.word.pronunciation === "").to.equal(true);
    expect(cardScore(out.word).complete).to.equal(false);
  });

  it("attaches offline English IPA onto a same-song card without a model call", () => {
    db.prepare("UPDATE users SET target_language = 'en', native_language = 'es' WHERE id = ?").run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    let aiCalls = 0;
    const original = aiService.glossDailyWords;
    aiService.glossDailyWords = async () => {
      aiCalls += 1;
      throw new Error("offline IPA must not call the models");
    };
    try {
      const out = attachCachedWordMeta({
        word: { text: "younger", translation: "más jóvenes", gloss_v: 2 },
        lyric: { snippet: "I was younger" },
      }, user);
      expect(out.word.pronunciation).to.match(/^\/.+\/$/);
      expect(cardScore(out.word).complete).to.equal(true);
      expect(aiCalls).to.equal(0);
    } finally {
      aiService.glossDailyWords = original;
      db.prepare("UPDATE users SET target_language = 'es', native_language = 'en' WHERE id = ?").run(userId);
    }
  });

  it("boot fill attaches cached IPA onto stored cards that already have a meaning", () => {
    db.prepare(`
      INSERT INTO daily_words (user_id, date, word_json)
      VALUES (?, ?, ?)
    `).run(userId, "2026-09-13", JSON.stringify({
      language_code: "es",
      word: { text: "casa", translation: "house", gloss_v: 2 },
    }));
    glossCache.rememberGloss("casa", "es", "en", "house", "ai", {
      pronunciation: "/ˈka.sa/",
      part_of_speech: "noun",
    });
    const filled = glossCache.fillThinStoredWords(() => null);
    expect(filled.updated).to.be.at.least(1);
    const row = db.prepare("SELECT word_json FROM daily_words WHERE user_id = ?").get(userId);
    const payload = JSON.parse(row.word_json);
    expect(payload.word.pronunciation).to.equal("/ˈka.sa/");
    expect(cardScore(payload.word).complete).to.equal(true);
  });

  it("enrichIfNeeded keeps Next instant: table meaning + cached IPA, zero model calls", async () => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    glossCache.rememberGloss("mundo", "es", "en", "world", "ai", {
      pronunciation: "/ˈmun.do/",
    });
    let aiCalls = 0;
    const original = aiService.glossDailyWords;
    aiService.glossDailyWords = async () => {
      aiCalls += 1;
      throw new Error("must stay instant");
    };
    const started = Date.now();
    try {
      const out = await enrichIfNeeded({
        word: { text: "mundo", translation: "world", gloss_v: 2 },
        lyric: { snippet: "todo el mundo" },
        song: { id: "1", title: "Song", artist: "Artist", genre: "pop" },
        audio: { duration_seconds: 180 },
      }, user);
      expect(Date.now() - started).to.be.below(200);
      expect(cardScore(out.word).complete).to.equal(true);
      expect(aiCalls).to.equal(0);
    } finally {
      aiService.glossDailyWords = original;
    }
  });
});
