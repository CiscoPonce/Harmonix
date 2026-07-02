const db = require("../db");

const REFILL_THRESHOLD = 5;
const QUEUE_MAX = 5;
const EXPIRY_DAYS = 7;

const refillInProgress = new Set();

function purgeExpired(userId) {
  db.prepare(`
    DELETE FROM user_word_queue
    WHERE user_id = ?
      AND (
        (consumed_at IS NULL AND expires_at <= datetime('now'))
        OR consumed_at IS NOT NULL
      )
  `).run(userId);
}

function countReady(userId) {
  purgeExpired(userId);
  return db.prepare(`
    SELECT COUNT(*) as count FROM user_word_queue
    WHERE user_id = ?
      AND consumed_at IS NULL
      AND expires_at > datetime('now')
  `).get(userId).count;
}

function enqueuePayloads(userId, payloads) {
  if (!payloads?.length) return 0;
  purgeExpired(userId);
  const ready = countReady(userId);
  const slots = Math.max(0, QUEUE_MAX - ready);
  if (slots === 0) return 0;

  const insert = db.prepare(`
    INSERT INTO user_word_queue (user_id, word_json, generated_at, expires_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', ?))
  `);

  let inserted = 0;
  for (const payload of payloads.slice(0, slots)) {
    insert.run(userId, JSON.stringify(payload), `+${EXPIRY_DAYS} days`);
    inserted += 1;
  }
  return inserted;
}

function peekNext(userId) {
  purgeExpired(userId);
  const row = db.prepare(`
    SELECT id, word_json FROM user_word_queue
    WHERE user_id = ?
      AND consumed_at IS NULL
      AND expires_at > datetime('now')
    ORDER BY id ASC
    LIMIT 1
  `).get(userId);
  if (!row) return null;
  try {
    return { id: row.id, payload: JSON.parse(row.word_json) };
  } catch {
    return null;
  }
}

function consumeNext(userId) {
  const item = peekNext(userId);
  if (!item) return null;
  db.prepare(`
    UPDATE user_word_queue SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(item.id);
  return item.payload;
}

function getQueuedWordTexts(userId) {
  purgeExpired(userId);
  return db.prepare(`
    SELECT word_json FROM user_word_queue
    WHERE user_id = ?
      AND consumed_at IS NULL
      AND expires_at > datetime('now')
  `).all(userId).map((row) => {
    try {
      return JSON.parse(row.word_json)?.word?.text;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function setRefilling(userId, active) {
  if (active) {
    refillInProgress.add(userId);
    db.prepare(`
      INSERT INTO user_queue_refill (user_id, refilling, started_at)
      VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET refilling = 1, started_at = CURRENT_TIMESTAMP
    `).run(userId);
  } else {
    refillInProgress.delete(userId);
    db.prepare(`
      INSERT INTO user_queue_refill (user_id, refilling, started_at)
      VALUES (?, 0, NULL)
      ON CONFLICT(user_id) DO UPDATE SET refilling = 0, started_at = NULL
    `).run(userId);
  }
}

function isRefilling(userId) {
  if (refillInProgress.has(userId)) return true;
  const row = db.prepare(
    "SELECT refilling, started_at FROM user_queue_refill WHERE user_id = ?"
  ).get(userId);
  if (!row?.refilling) return false;

  // DB flag survived a crash/restart — not actually refilling in this process.
  if (!refillInProgress.has(userId)) {
    setRefilling(userId, false);
    return false;
  }

  return true;
}

function listReadyItems(userId) {
  purgeExpired(userId);
  return db.prepare(`
    SELECT id, word_json FROM user_word_queue
    WHERE user_id = ?
      AND consumed_at IS NULL
      AND expires_at > datetime('now')
    ORDER BY id ASC
  `).all(userId).map((row) => {
    try {
      return { id: row.id, payload: JSON.parse(row.word_json) };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function updatePayload(id, payload) {
  db.prepare(`
    UPDATE user_word_queue SET word_json = ? WHERE id = ?
  `).run(JSON.stringify(payload), id);
}

function getQueueStatus(userId) {
  return {
    ready: countReady(userId),
    refilling: isRefilling(userId),
    target: REFILL_THRESHOLD,
    max: QUEUE_MAX,
  };
}

function triggerRefillIfNeeded(user, refillFn) {
  if (!user?.id) return;
  const ready = countReady(user.id);
  if (ready >= REFILL_THRESHOLD || isRefilling(user.id)) return;

  setRefilling(user.id, true);
  setImmediate(async () => {
    try {
      await refillFn(user);
    } catch (err) {
      console.warn(`queue refill failed for ${user.id}:`, err.message || err);
    } finally {
      setRefilling(user.id, false);
    }
  });
}

function discard(id) {
  db.prepare(`DELETE FROM user_word_queue WHERE id = ?`).run(id);
}

function consumeById(id) {
  db.prepare(`
    UPDATE user_word_queue SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
}

function purgeAll(userId) {
  db.prepare(`
    DELETE FROM user_word_queue WHERE user_id = ?
  `).run(userId);
}

module.exports = {
  REFILL_THRESHOLD,
  QUEUE_MAX,
  EXPIRY_DAYS,
  purgeExpired,
  purgeAll,
  discard,
  consumeById,
  countReady,
  enqueuePayloads,
  peekNext,
  consumeNext,
  listReadyItems,
  updatePayload,
  getQueuedWordTexts,
  getQueueStatus,
  isRefilling,
  setRefilling,
  triggerRefillIfNeeded,
  _refillInProgress: refillInProgress,
};
