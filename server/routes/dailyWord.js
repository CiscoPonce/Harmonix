const express = require("express");
const router = express.Router();
const db = require("../db");
const dailyWordService = require("../services/dailyWordService");
const wordQueue = require("../services/wordQueueService");
const ttsService = require("../services/ttsService");

function loadUser(userId) {
  return db.prepare(
    "SELECT id, email, cefr_level, native_language, target_language, genre, difficulty, voice_gender FROM users WHERE id = ?"
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
    ttsService.preCachePronunciation(payload.word.text, user.target_language, user.voice_gender || 'female').catch(() => {});
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

    const payload = await dailyWordService.generateNextDailyWord(user);

    console.log(`POST /api/daily-word/next - success in ${Date.now() - started}ms: ${payload.word.text}${payload.from_queue ? " (queue)" : ""}`);
    res.json({ ...payload, queue: wordQueue.getQueueStatus(user.id) });
    ttsService.preCachePronunciation(payload.word.text, user.target_language, user.voice_gender || 'female').catch(() => {});
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

router.get("/pronounce", async (req, res) => {
  const { word, lang } = req.query;
  if (!word || !word.trim() || word.length > 100) {
    return res.status(400).json({ error: "word required" });
  }

  const user = req.user ? loadUser(req.user.id) : null;
  const langCode = (lang && ttsService.SUPPORTED_LANGUAGES.includes(lang.toString().trim()))
    ? lang.toString().trim()
    : (user?.target_language || "es");
  if (!ttsService.SUPPORTED_LANGUAGES.includes(langCode)) {
    return res.status(404).json({ error: "unsupported_language" });
  }

  try {
    const audioBuffer = await ttsService.getPronunciationForWord(
      word.trim(),
      langCode,
      user.voice_gender || 'female'
    );
    const buf = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", buf.length.toString());
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (err) {
    console.error("GET /api/daily-word/pronounce error:", err.message);
    if (err.code === "unsupported_language") {
      return res.status(404).json({ error: "unsupported_language" });
    }
    if (err.code === "tts_generation_failed") {
      return res.status(502).json({ error: "tts_generation_failed" });
    }
    res.status(502).json({ error: "tts_unavailable" });
  }
});

module.exports = router;
