const { expect } = require("chai");
const db = require("../db");
const glossCache = require("./glossCacheService");

describe("glossCacheService", () => {
  beforeEach(() => {
    db.exec("DELETE FROM gloss_cache");
  });

  it("stores and returns a gloss by word + language pair", () => {
    expect(glossCache.rememberGloss("Nights", "en", "es", "noches", "test")).to.equal(true);
    expect(glossCache.getGloss("nights", "EN", "ES")).to.equal("noches");
  });

  it("rejects identity translations and empty pairs", () => {
    expect(glossCache.rememberGloss("nights", "en", "es", "nights")).to.equal(false);
    expect(glossCache.rememberGloss("nights", "en", "en", "noches")).to.equal(false);
    expect(glossCache.getGloss("nights", "en", "es")).to.equal(null);
  });

  it("backfills healthy historical daily words", () => {
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run("u-gloss-1");
    db.prepare("DELETE FROM users WHERE id = ?").run("u-gloss-1");
    db.prepare(`
      INSERT INTO users (id, email, password_hash, native_language, target_language)
      VALUES (?, ?, ?, ?, ?)
    `).run("u-gloss-1", "gloss-cache@test.local", "x", "es", "en");
    db.prepare(`
      INSERT INTO daily_words (user_id, date, word_json)
      VALUES (?, ?, ?)
    `).run("u-gloss-1", "2026-09-05", JSON.stringify({
      language_code: "en",
      word: { text: "zxqbackfillwaves", translation: "olas", gloss_v: 2 },
      lyric: { snippet: "the waves keep crashing" },
    }));
    db.prepare(`
      INSERT INTO daily_words (user_id, date, word_json)
      VALUES (?, ?, ?)
    `).run("u-gloss-1", "2026-09-04", JSON.stringify({
      language_code: "en",
      word: { text: "zxqbackfillthin", translation: null, gloss_v: 1 },
    }));

    const inserted = glossCache.backfillFromDailyWords();
    expect(inserted).to.be.at.least(1);
    expect(glossCache.getGloss("zxqbackfillwaves", "en", "es")).to.equal("olas");
    expect(glossCache.getGloss("zxqbackfillthin", "en", "es")).to.equal(null);
  });
});
