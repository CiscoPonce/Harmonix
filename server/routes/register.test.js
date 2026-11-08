const assert = require("assert");
const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const auth = require("../auth");
const registerRoutes = require("./register");
const { EmailVerificationError } = require("../services/emailVerificationClient");

const CHALLENGE = "challenge-id-0123456789abcdef";

function fakeClient(overrides = {}) {
  const calls = [];
  return {
    calls,
    async challenge(email) {
      calls.push({ op: "challenge", email });
      if (overrides.challenge) return overrides.challenge(email);
      return { challengeId: CHALLENGE, expiresAt: "2026-11-08T20:10:00+00:00" };
    },
    async verify(challengeId, code) {
      calls.push({ op: "verify", challengeId, code });
      if (overrides.verify) return overrides.verify(challengeId, code);
      if (code !== "042817") {
        throw new EmailVerificationError("invalid_code", 400, "That code is not correct.");
      }
      return { email: overrides.confirmedEmail || "new-person@example.com" };
    },
  };
}

async function post(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { status: res.status, payload };
}

describe("signup verification routes", () => {
  let server;
  let baseUrl;
  let client;
  const created = [];

  before(async () => {
    client = fakeClient();
    const app = express();
    app.use(express.json());
    app.use("/api/auth", registerRoutes({ client }));
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after((done) => {
    for (const email of created) {
      db.prepare("DELETE FROM users WHERE lower(email) = ?").run(email);
    }
    server.close(done);
  });

  it("does not create an account from the old register call", async () => {
    const email = `old-${nanoid(6)}@example.com`;
    const res = await post(baseUrl, "/api/auth/register", {
      email,
      password: "correct horse",
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.payload.code, "email_verification_required");
    assert.strictEqual(db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email), undefined);
    assert.strictEqual(client.calls.length, 0);
  });

  it("does not mail an address that already has an account", async () => {
    const email = `taken-${nanoid(6)}@example.com`;
    created.push(email);
    db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
      nanoid(),
      email,
      await auth.hashPassword("already-set-1"),
    );
    const before = client.calls.length;
    const res = await post(baseUrl, "/api/auth/register/challenge", {
      email,
      password: "another-password",
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.payload.error, "Email already registered");
    assert.strictEqual(client.calls.length, before);
  });

  it("issues a challenge without storing the person or the password", async () => {
    const email = "new-person@example.com";
    const res = await post(baseUrl, "/api/auth/register/challenge", {
      email: "  New-Person@Example.com ",
      password: "correct horse",
      purpose: "please-mail-someone-else",
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.payload.challenge_id, CHALLENGE);
    assert.strictEqual(res.payload.code, undefined);
    assert.deepStrictEqual(client.calls.at(-1), { op: "challenge", email });
    assert.strictEqual(db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email), undefined);
  });

  it("rejects a short password and a bad code before calling the mail service", async () => {
    const before = client.calls.length;
    const weak = await post(baseUrl, "/api/auth/register/challenge", {
      email: "weak@example.com",
      password: "short",
    });
    assert.strictEqual(weak.status, 400);
    const badCode = await post(baseUrl, "/api/auth/register/verify", {
      email: "new-person@example.com",
      password: "correct horse",
      challenge_id: CHALLENGE,
      code: "12",
    });
    assert.strictEqual(badCode.status, 400);
    assert.strictEqual(client.calls.length, before);
  });

  it("does not create an account when the code is wrong or confirms another address", async () => {
    const email = "new-person@example.com";
    const wrong = await post(baseUrl, "/api/auth/register/verify", {
      email,
      password: "correct horse",
      challenge_id: CHALLENGE,
      code: "000000",
    });
    assert.strictEqual(wrong.status, 400);
    assert.strictEqual(wrong.payload.error, "That code is not correct.");
    assert.strictEqual(db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email), undefined);

    client.verify = async () => ({ email: "other@example.com" });
    const mismatch = await post(baseUrl, "/api/auth/register/verify", {
      email,
      password: "correct horse",
      challenge_id: CHALLENGE,
      code: "042817",
    });
    assert.strictEqual(mismatch.status, 400);
    assert.strictEqual(db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email), undefined);
  });

  it("creates the account only after the code matches, and the password is hashed", async () => {
    const email = "new-person@example.com";
    created.push(email);
    client.verify = async () => ({ email });
    const res = await post(baseUrl, "/api/auth/register/verify", {
      email,
      password: "correct horse",
      challenge_id: CHALLENGE,
      code: "042817",
      source: "postcard",
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(typeof res.payload.accessToken, "string");
    assert.strictEqual(res.payload.user.email, email);
    const row = db.prepare("SELECT password_hash FROM users WHERE lower(email) = ?").get(email);
    assert.notStrictEqual(row.password_hash, "correct horse");
    assert.strictEqual(await auth.comparePassword("correct horse", row.password_hash), true);
    const event = db.prepare(
      "SELECT props_json FROM usage_events WHERE user_id = ? AND name = 'signup'",
    ).get(res.payload.user.id);
    assert.strictEqual(JSON.parse(event.props_json).source, "postcard");

    const leaked = await post(baseUrl, "/api/auth/register/verify", {
      email: `other-${nanoid(4)}@example.com`,
      password: "correct horse",
      challenge_id: CHALLENGE,
      code: "042817",
    });
    client.verify = async () => {
      throw new Error(`upstream blew up with ${"secret-key-should-not-leak"}`);
    };
    const hidden = await post(baseUrl, "/api/auth/register/verify", {
      email: `hidden-${nanoid(4)}@example.com`,
      password: "correct horse",
      challenge_id: CHALLENGE,
      code: "042817",
    });
    assert.strictEqual(hidden.status, 500);
    assert.strictEqual(JSON.stringify(hidden.payload).includes("secret-key"), false);
    assert.strictEqual(leaked.status, 400);
  });
});
