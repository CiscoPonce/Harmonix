const { expect } = require('chai');

describe('security middleware', () => {
  const {
    corsOrigin,
    validateRegistration,
    securityHeaders,
    ALLOWED_ORIGINS,
  } = require('./security');

  const cors = (origin) => new Promise((resolve) => corsOrigin(origin, (_e, ok) => resolve(ok)));

  it('allows same-origin / no-Origin callers and rejects arbitrary sites', async () => {
    expect(await cors(undefined)).to.equal(true);
    expect(await cors('https://evil.example')).to.equal(false);
    expect(await cors('capacitor://localhost')).to.equal(true);
    if (ALLOWED_ORIGINS.size) {
      const [first] = ALLOWED_ORIGINS;
      expect(await cors(first)).to.equal(true);
    }
  });

  it('validates registration input', () => {
    expect(validateRegistration('', '')).to.have.property('error');
    expect(validateRegistration('not-an-email', 'longenough1')).to.have.property('error');
    expect(validateRegistration('a@b.co', 'short')).to.have.property('error');
    const ok = validateRegistration('  Learner@Example.com ', 'correct horse battery');
    expect(ok.email).to.equal('learner@example.com');
    expect(ok.password).to.equal('correct horse battery');
  });

  it('sets hardening headers and HSTS only over https', () => {
    const run = (secure) => {
      const headers = {};
      const req = { secure, headers: {} };
      const res = { setHeader: (k, v) => { headers[k] = v; } };
      let called = false;
      securityHeaders(req, res, () => { called = true; });
      expect(called).to.equal(true);
      return headers;
    };
    const plain = run(false);
    expect(plain['X-Content-Type-Options']).to.equal('nosniff');
    expect(plain['X-Frame-Options']).to.equal('SAMEORIGIN');
    expect(plain).to.not.have.property('Strict-Transport-Security');
    const tls = run(true);
    expect(tls['Strict-Transport-Security']).to.match(/max-age=\d+/);
  });
});
