const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { nanoid } = require("nanoid");
const db = require("../db");
const auth = require("../auth");
const { validateRegistration } = require("../middleware/security");
const { createClient, EmailVerificationError } = require("../services/emailVerificationClient");
const { recordEvent, normalizeSignupSource } = require("../services/usageEvents");

const CHALLENGE_ID_RE = /^[A-Za-z0-9_-]{20,200}$/;
const CODE_RE = /^\d{6}$/;

function limit(max, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "test" ? 1000 : max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        code: "resend_limited",
      });
    },
  });
}

function sendFailure(res, err) {
  if (err instanceof EmailVerificationError) {
    if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
    return res.status(err.status).json({
      error: err.publicMessage,
      code: err.code,
    });
  }
  console.error("signup verification failed");
  return res.status(500).json({ error: "Internal server error", code: "internal" });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    native_language: user.native_language,
    target_language: user.target_language,
    genre: user.genre,
    difficulty: user.difficulty,
    cefr_level: user.cefr_level,
  };
}

function registerRoutes(options = {}) {
  const database = options.db || db;
  const authenticator = options.auth || auth;
  const client = options.client || createClient();
  const record = options.recordEvent || recordEvent;
  const signupSource = options.normalizeSignupSource || normalizeSignupSource;
  const findUser = database.prepare("SELECT id FROM users WHERE lower(email) = ?");
  const insertUser = database.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  );
  const loadUser = database.prepare("SELECT * FROM users WHERE id = ?");

  const router = express.Router();

  router.post("/register", (req, res) => {
    res.status(403).json({
      error: "Create your account with the verification code.",
      code: "email_verification_required",
    });
  });

  router.post("/register/challenge", limit(5, "Too many codes were requested. Try again in a few minutes."), async (req, res) => {
    const checked = validateRegistration(req.body?.email, req.body?.password);
    if (checked.error) return res.status(400).json({ error: checked.error, code: "invalid_input" });
    if (findUser.get(checked.email)) {
      return res.status(409).json({ error: "Email already registered", code: "email_taken" });
    }
    try {
      const issued = await client.challenge(checked.email);
      return res.status(200).json({
        challenge_id: issued.challengeId,
        expires_at: issued.expiresAt,
      });
    } catch (err) {
      return sendFailure(res, err);
    }
  });

  router.post("/register/verify", limit(15, "Too many attempts. Try again in a few minutes."), async (req, res) => {
    const checked = validateRegistration(req.body?.email, req.body?.password);
    if (checked.error) return res.status(400).json({ error: checked.error, code: "invalid_input" });
    const challengeId = String(req.body?.challenge_id || "").trim();
    const code = String(req.body?.code || "").trim();
    if (!CHALLENGE_ID_RE.test(challengeId) || !CODE_RE.test(code)) {
      return res.status(400).json({
        error: "Enter the six-digit code from your email.",
        code: "invalid_input",
      });
    }
    if (findUser.get(checked.email)) {
      return res.status(409).json({ error: "Email already registered", code: "email_taken" });
    }

    let confirmed;
    try {
      confirmed = await client.verify(challengeId, code);
    } catch (err) {
      return sendFailure(res, err);
    }
    if (confirmed.email !== checked.email) {
      return res.status(400).json({
        error: "This code is no longer valid. Request a new code.",
        code: "invalid_challenge",
      });
    }

    const id = nanoid();
    const passwordHash = await authenticator.hashPassword(checked.password);
    try {
      const created = database.transaction(() => {
        if (findUser.get(checked.email)) return null;
        insertUser.run(id, checked.email, passwordHash);
        return loadUser.get(id);
      })();
      if (!created) {
        return res.status(409).json({ error: "Email already registered", code: "email_taken" });
      }
      record("signup", {
        userId: created.id,
        req,
        props: { source: signupSource(req.body?.source) },
      });
      const accessToken = authenticator.generateAccessToken(created);
      const refreshToken = authenticator.issueRefreshSession(created);
      res.cookie("refreshToken", refreshToken, authenticator.authCookieOptions(req));
      return res.status(201).json({
        accessToken,
        refreshToken,
        user: publicUser(created),
      });
    } catch (err) {
      if (String(err.message || "").includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already registered", code: "email_taken" });
      }
      console.error("signup create failed");
      return res.status(500).json({ error: "Internal server error", code: "internal" });
    }
  });

  return router;
}

module.exports = registerRoutes;
