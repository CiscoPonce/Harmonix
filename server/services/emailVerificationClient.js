/**
 * Server-side client for the private 2FA email service.
 * The API key never leaves this process. Callers cannot choose the message.
 */

const PURPOSE = "harmonix-signup";
const TTL_SECONDS = 600;
const PRODUCTION_ORIGIN = "https://email-auth.ponceteam.com";
const CHALLENGE_ID_RE = /^[A-Za-z0-9_-]{20,200}$/;
const ISO_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const MAX_BODY = 4000;

class EmailVerificationError extends Error {
  constructor(code, status, publicMessage, retryAfter) {
    super(publicMessage);
    this.name = "EmailVerificationError";
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
    this.retryAfter = retryAfter;
  }
}

function unavailable(code = "signup_unavailable") {
  return new EmailVerificationError(
    code,
    503,
    "Account creation is temporarily unavailable.",
  );
}

function originFromEnv(env) {
  const raw = String(env.TWOFA_BASE_URL || PRODUCTION_ORIGIN).trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw unavailable();
  }
  if (url.protocol !== "https:" || url.username || url.password) throw unavailable();
  if (url.pathname !== "/" && url.pathname !== "") throw unavailable();
  if (url.search || url.hash) throw unavailable();
  if (env.NODE_ENV === "production" && url.origin !== PRODUCTION_ORIGIN) throw unavailable();
  return url.origin;
}

function apiKey(env) {
  const key = String(env.TWOFA_API_KEY || "").trim();
  if (!key || key.length < 16) throw unavailable();
  return key;
}

function publicError(payload) {
  const code = String(payload?.error?.code || "");
  const retry = Number(payload?.error?.details?.retry_after_seconds);
  const retryAfter = Number.isInteger(retry) && retry >= 1 && retry <= 3600 ? retry : undefined;
  if (code === "resend_limited") {
    return new EmailVerificationError(
      code,
      429,
      "A code was just sent to that address. Wait a minute before asking for another.",
      retryAfter,
    );
  }
  if (code === "invalid_email") {
    return new EmailVerificationError(code, 400, "Enter a valid email address");
  }
  if (code === "invalid_code") {
    return new EmailVerificationError(code, 400, "That code is not correct.");
  }
  if (code === "too_many_attempts") {
    return new EmailVerificationError(code, 400, "Too many wrong codes. Request a new code.");
  }
  if (code === "code_expired") {
    return new EmailVerificationError(code, 400, "This code has expired. Request a new code.");
  }
  if (code === "invalid_challenge") {
    return new EmailVerificationError(code, 400, "This code is no longer valid. Request a new code.");
  }
  if (code === "email_delivery_failed") {
    return new EmailVerificationError(
      code,
      502,
      "The verification email could not be sent. Try again shortly.",
    );
  }
  return unavailable();
}

async function readPayload(res) {
  const text = await res.text();
  if (text.length > MAX_BODY) throw unavailable();
  const type = String(res.headers.get("content-type") || "");
  if (!type.includes("application/json")) throw unavailable();
  try {
    return JSON.parse(text);
  } catch {
    throw unavailable();
  }
}

async function postVerification({ env, fetchImpl, path, body }) {
  const origin = originFromEnv(env);
  const key = apiKey(env);
  const url = `${origin}${path}`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw unavailable();
  }
  const payload = await readPayload(res);
  if (!res.ok) throw publicError(payload);
  return payload;
}

function createClient({ env = process.env, fetchImpl = fetch } = {}) {
  return {
    async challenge(email) {
      const payload = await postVerification({
        env,
        fetchImpl,
        path: "/2fa-email/challenge",
        body: { email, purpose: PURPOSE, ttl_seconds: TTL_SECONDS },
      });
      const challengeId = String(payload?.challenge_id || "");
      if (!CHALLENGE_ID_RE.test(challengeId)) throw unavailable();
      const expiresAt = String(payload?.expires_at || "");
      return {
        challengeId,
        expiresAt: ISO_TIME_RE.test(expiresAt) ? expiresAt : null,
      };
    },
    async verify(challengeId, code) {
      const payload = await postVerification({
        env,
        fetchImpl,
        path: "/2fa-email/verify",
        body: { challenge_id: challengeId, code },
      });
      if (payload?.valid !== true) throw unavailable();
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || email.length > 254 || /[\r\n]/.test(email)) throw unavailable();
      return { email };
    },
  };
}

module.exports = {
  PURPOSE,
  TTL_SECONDS,
  PRODUCTION_ORIGIN,
  EmailVerificationError,
  createClient,
};
