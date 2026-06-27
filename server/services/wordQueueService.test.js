const { expect } = require("chai");
const db = require("../db");
const wordQueue = require("./wordQueueService");

describe("Word Queue Service", () => {
  const userId = "queue-test-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "q@test.com", "x");
    db.prepare("DELETE FROM user_word_queue WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_queue_refill WHERE user_id = ?").run(userId);
    wordQueue._refillInProgress.delete(userId);
  });

  const samplePayload = (word) => ({
    date: "2026-06-27",
    word: { text: word, translation: word },
    song: { id: "1", title: "Song", artist: "Artist" },
    lyric: { snippet: word, timestamp: "0:01", timestamp_ms: 1000, line_index: 0, char_start: 0, char_end: word.length },
    audio: { preview_url: "http://x", duration_seconds: 180, preview_offset: 30 },
  });

  it("enqueues and counts ready validated payloads", () => {
    const inserted = wordQueue.enqueuePayloads(userId, [
      samplePayload("uno"),
      samplePayload("dos"),
    ]);
    expect(inserted).to.equal(2);
    expect(wordQueue.countReady(userId)).to.equal(2);
  });

  it("consumes queue items in FIFO order", () => {
    wordQueue.enqueuePayloads(userId, [samplePayload("uno"), samplePayload("dos")]);
    const first = wordQueue.consumeNext(userId);
    const second = wordQueue.consumeNext(userId);
    expect(first.word.text).to.equal("uno");
    expect(second.word.text).to.equal("dos");
    expect(wordQueue.countReady(userId)).to.equal(0);
  });

  it("respects max queue size", () => {
    const payloads = Array.from({ length: 8 }, (_, i) => samplePayload(`w${i}`));
    const inserted = wordQueue.enqueuePayloads(userId, payloads);
    expect(inserted).to.equal(wordQueue.QUEUE_MAX);
    expect(wordQueue.countReady(userId)).to.equal(wordQueue.QUEUE_MAX);
  });

  it("reports queue status with refilling flag", () => {
    wordQueue.enqueuePayloads(userId, [samplePayload("ready")]);
    wordQueue.setRefilling(userId, true);
    const status = wordQueue.getQueueStatus(userId);
    expect(status.ready).to.equal(1);
    expect(status.refilling).to.equal(true);
    expect(status.target).to.equal(wordQueue.REFILL_THRESHOLD);
    wordQueue.setRefilling(userId, false);
  });

  it("tracks queued word texts for dedupe", () => {
    wordQueue.enqueuePayloads(userId, [samplePayload("amor"), samplePayload("noche")]);
    expect(wordQueue.getQueuedWordTexts(userId)).to.include.members(["amor", "noche"]);
  });
});
