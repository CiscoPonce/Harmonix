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

  it("remembers pronunciation without wiping it on a later meaning-only write", () => {
    expect(glossCache.rememberGloss("nights", "en", "es", "noches", "ai", {
      pronunciation: "/naɪts/",
      part_of_speech: "noun",
    })).to.equal(true);
    const first = glossCache.getGlossWithSource("nights", "en", "es");
    expect(first.pronunciation).to.equal("/naɪts/");
    expect(first.part_of_speech).to.equal("noun");
    glossCache.rememberGloss("nights", "en", "es", "noches", "curated");
    const again = glossCache.getGlossWithSource("nights", "en", "es");
    expect(again.translation).to.equal("noches");
    expect(again.pronunciation).to.equal("/naɪts/");
    expect(again.part_of_speech).to.equal("noun");
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

  it("replaces a cached wrong-sense gloss on the shelf and in the cache", () => {
    db.prepare("DELETE FROM daily_words WHERE user_id = ?").run("u-gloss-lady");
    db.prepare("DELETE FROM users WHERE id = ?").run("u-gloss-lady");
    db.prepare(`
      INSERT INTO users (id, email, password_hash, native_language, target_language)
      VALUES (?, ?, ?, ?, ?)
    `).run("u-gloss-lady", "gloss-lady@test.local", "x", "es", "en");
    db.prepare(`
      INSERT INTO daily_words (user_id, date, word_json)
      VALUES (?, ?, ?)
    `).run("u-gloss-lady", "2026-09-24", JSON.stringify({
      language_code: "en",
      word: { text: "lady", translation: "ama", pronunciation: "/ˈleɪdi/", gloss_v: 2 },
      lyric: { snippet: "There's a lady who's sure" },
    }));
    glossCache.rememberGloss("lady", "en", "es", "ama", "ai");

    const repaired = glossCache.replaceSuspiciousStoredGlosses(
      (word, translation) => word === "lady" && translation === "ama",
      () => ({ translation: "dama", trusted: true }),
    );
    expect(repaired.updated).to.equal(1);
    expect(glossCache.getGloss("lady", "en", "es")).to.equal("dama");
    const row = db.prepare("SELECT word_json FROM daily_words WHERE user_id = ?").get("u-gloss-lady");
    expect(JSON.parse(row.word_json).word.translation).to.equal("dama");
  });
});
