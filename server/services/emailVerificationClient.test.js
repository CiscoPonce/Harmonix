const { expect } = require("chai");
const { EmailVerificationError, createClient, PURPOSE, TTL_SECONDS } = require("./emailVerificationClient");

const KEY = "test-direct-key-0123456789";
const ORIGIN = "https://email-auth.test";

function env() {
  return { NODE_ENV: "test", TWOFA_BASE_URL: ORIGIN, TWOFA_API_KEY: KEY };
}

function jsonResponse(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || "application/json" },
    text: async () => JSON.stringify(payload),
  };
}

describe("email verification client", () => {
  it("refuses an http base URL before any request", async () => {
    let called = false;
    const client = createClient({
      env: { ...env(), TWOFA_BASE_URL: "http://email-auth.test" },
      fetchImpl: async () => {
        called = true;
        throw new Error("should not be called");
      },
    });
    try {
      await client.challenge("person@example.com");
      expect.fail("expected a refusal");
    } catch (err) {
      expect(err).to.be.instanceOf(EmailVerificationError);
      expect(err.status).to.equal(503);
      expect(called).to.equal(false);
    }
  });

  it("refuses a missing key and a production host that is not the mail service", async () => {
    const missing = createClient({
      env: { NODE_ENV: "test", TWOFA_BASE_URL: ORIGIN, TWOFA_API_KEY: "" },
      fetchImpl: async () => {
        throw new Error("should not be called");
      },
    });
    try {
      await missing.challenge("person@example.com");
      expect.fail("expected a refusal");
    } catch (err) {
      expect(err.code).to.equal("signup_unavailable");
    }

    const wrongHost = createClient({
      env: {
        NODE_ENV: "production",
        TWOFA_BASE_URL: "https://evil.example",
        TWOFA_API_KEY: KEY,
      },
      fetchImpl: async () => {
        throw new Error("should not be called");
      },
    });
    try {
      await wrongHost.challenge("person@example.com");
      expect.fail("expected a refusal");
    } catch (err) {
      expect(err.status).to.equal(503);
    }
  });

  it("sends only the address, a fixed purpose, and the server lifetime", async () => {
    let seen;
    const client = createClient({
      env: env(),
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return jsonResponse(200, {
          challenge_id: "a".repeat(32),
          expires_at: "2026-11-08T20:10:00+00:00",
          code: "999999",
        });
      },
    });
    const issued = await client.challenge("person@example.com");
    const body = JSON.parse(seen.init.body);
    expect(seen.url).to.equal(`${ORIGIN}/2fa-email/challenge`);
    expect(seen.url).to.not.include(KEY);
    expect(seen.init.redirect).to.equal("error");
    expect(seen.init.headers.Authorization).to.equal(`Bearer ${KEY}`);
    expect(body).to.deep.equal({
      email: "person@example.com",
      purpose: PURPOSE,
      ttl_seconds: TTL_SECONDS,
    });
    expect(body.password).to.equal(undefined);
    expect(issued.challengeId).to.equal("a".repeat(32));
    expect(issued).to.not.have.property("code");
  });

  it("hides upstream and network details, including the API key", async () => {
    const client = createClient({
      env: env(),
      fetchImpl: async () => {
        throw new Error(`socket hang up ${KEY}`);
      },
    });
    try {
      await client.challenge("person@example.com");
      expect.fail("expected a refusal");
    } catch (err) {
      expect(err.publicMessage).to.not.include(KEY);
      expect(err.message).to.not.include(KEY);
      expect(err.status).to.equal(503);
    }
  });

  it("maps a wrong code and a resend limit without forwarding upstream text", async () => {
    const wrong = createClient({
      env: env(),
      fetchImpl: async () => jsonResponse(400, {
        error: { code: "invalid_code", message: `leak ${KEY}`, details: { attempts_remaining: 4 } },
      }),
    });
    try {
      await wrong.verify("b".repeat(32), "000000");
      expect.fail("expected a refusal");
    } catch (err) {
      expect(err.code).to.equal("invalid_code");
      expect(err.publicMessage).to.equal("That code is not correct.");
      expect(err.publicMessage).to.not.include(KEY);
    }

    const limited = createClient({
      env: env(),
      fetchImpl: async () => jsonResponse(429, {
        error: { code: "resend_limited", details: { retry_after_seconds: 45 } },
      }),
    });
    try {
      await limited.challenge("person@example.com");
      expect.fail("expected a refusal");
    } catch (err) {
      expect(err.status).to.equal(429);
      expect(err.retryAfter).to.equal(45);
    }
  });

  it("returns only the confirmed address from verify", async () => {
    const client = createClient({
      env: env(),
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        expect(url).to.equal(`${ORIGIN}/2fa-email/verify`);
        expect(body).to.deep.equal({ challenge_id: "c".repeat(32), code: "042817" });
        return jsonResponse(200, {
          valid: true,
          email: "Person@Example.com",
          code: "042817",
        });
      },
    });
    const confirmed = await client.verify("c".repeat(32), "042817");
    expect(confirmed).to.deep.equal({ email: "person@example.com" });
  });
});
