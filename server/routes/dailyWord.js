const express = require("express");
const router = express.Router();
const db = require("../db");
const dailyWordService = require("../services/dailyWordService");
const wordQueue = require("../services/wordQueueService");

function loadUser(userId) {
  return db.prepare(
    "SELECT id, email, cefr_level, target_language, genre, difficulty FROM users WHERE id = ?"
  ).get(userId);
}

async function handleDailyWord(req, res, force) {
  const started = Date.now();
  console.log(`${req.method} /api/daily-word${force ? "/new" : ""} - user: ${req.user.id}, force=${force}`);
  try {
    const user = loadUser(req.user.id);
    if (!user) return res.sendStatus(404);

    const payload = await dailyWordService.generateDailyWord(user, { force });
    console.log(`${req.method} /api/daily-word${force ? "/new" : ""} - success in ${Date.now() - started}ms: ${payload.word.text}${payload.from_queue ? " (queue)" : ""}`);
    res.json({ ...payload, queue: wordQueue.getQueueStatus(user.id) });
  } catch (err) {
    console.error(`${req.method} /api/daily-word${force ? "/new" : ""} - failed in ${Date.now() - started}ms:`, err.code || err.message);
    const reason = err.code || err.message;
    res.status(reason === "cooldown_active" ? 429 : 503).json({
      error: "daily_word_unavailable",
      reason,
      retryAfterSec: err.retryAfterSec || null,
      queue: wordQueue.getQueueStatus(req.user.id),
    });
  }
}

router.get("/recent", (req, res) => {
  const days = req.query.days || 7;
  const recent = dailyWordService.getRecentDailyWords(req.user.id, days);
  res.json({ recent });
});

router.get("/queue-status", (req, res) => {
  res.json(wordQueue.getQueueStatus(req.user.id));
});

router.post("/next", async (req, res) => {
  const started = Date.now();
  console.log(`POST /api/daily-word/next - user: ${req.user.id}`);
  try {
    const user = loadUser(req.user.id);
    if (!user) return res.sendStatus(404);

    let payload = await dailyWordService.consumeNextDailyWord(user);
    if (!payload) {
      payload = await dailyWordService.generateDailyWord(user, { force: true });
    }

    console.log(`POST /api/daily-word/next - success in ${Date.now() - started}ms: ${payload.word.text}${payload.from_queue ? " (queue)" : ""}`);
    res.json({ ...payload, queue: wordQueue.getQueueStatus(user.id) });
  } catch (err) {
    console.error(`POST /api/daily-word/next - failed in ${Date.now() - started}ms:`, err.code || err.message);
    const reason = err.code || err.message;
    res.status(reason === "cooldown_active" ? 429 : 503).json({
      error: "daily_word_unavailable",
      reason,
      retryAfterSec: err.retryAfterSec || null,
      queue: wordQueue.getQueueStatus(req.user.id),
    });
  }
});

router.get("/", (req, res) => handleDailyWord(req, res, false));
router.post("/new", (req, res) => handleDailyWord(req, res, true));

module.exports = router;
