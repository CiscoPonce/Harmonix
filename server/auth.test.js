const { expect } = require('chai');
const { nanoid } = require('nanoid');
const auth = require('./auth');
const db = require('./db');

describe('Auth Logic', () => {
  const user = { id: 'test-id', email: 'test@example.com' };

  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'password123';
      const hash = await auth.hashPassword(password);
      expect(hash).to.not.equal(password);
      expect(hash).to.be.a('string');
    });

    it('should compare password with hash correctly', async () => {
      const password = 'password123';
      const hash = await auth.hashPassword(password);
      const isMatch = await auth.comparePassword(password, hash);
      const isNotMatch = await auth.comparePassword('wrong-password', hash);
      expect(isMatch).to.be.true;
      expect(isNotMatch).to.be.false;
    });
  });

  describe('JWT Tokens', () => {
    it('should generate a valid access token', () => {
      const token = auth.generateAccessToken(user);
      const payload = auth.verifyAccessToken(token);
      expect(payload.id).to.equal(user.id);
      expect(payload.email).to.equal(user.email);
    });

    it('should generate a valid refresh token bound to a jti', () => {
      const token = auth.generateRefreshToken(user, 'jti-1');
      const payload = auth.verifyRefreshToken(token);
      expect(payload.id).to.equal(user.id);
      expect(payload.email).to.equal(user.email);
      expect(payload.jti).to.equal('jti-1');
    });

    it('refuses a refresh token without a session id', () => {
      expect(() => auth.generateRefreshToken(user)).to.throw(/jti/);
    });

    it('should throw error for invalid access token', () => {
      expect(() => auth.verifyAccessToken('invalid-token')).to.throw();
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => auth.verifyRefreshToken('invalid-token')).to.throw();
    });
  });

  describe('Refresh sessions', () => {
    const email = `refresh-${nanoid(8)}@harmonix.test`;
    let userId;

    before(async () => {
      userId = nanoid();
      const hash = await auth.hashPassword('password123');
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
        userId,
        email,
        hash
      );
    });

    after(() => {
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });

    it('rotates the refresh token and rejects the previous one', () => {
      const sessionUser = { id: userId, email };
      const first = auth.issueRefreshSession(sessionUser);
      const rotated = auth.rotateRefreshSession(first);
      expect(rotated.accessToken).to.be.a('string');
      expect(rotated.refreshToken).to.not.equal(first);
      expect(() => auth.rotateRefreshSession(first)).to.throw(/refresh_revoked/);
    });

    it('rejects a copied refresh token after logout', () => {
      const sessionUser = { id: userId, email };
      const token = auth.issueRefreshSession(sessionUser);
      expect(auth.revokeRefreshSession(token)).to.equal(true);
      expect(() => auth.rotateRefreshSession(token)).to.throw(/refresh_revoked/);
    });

    it('rejects every refresh token for the user after a full revoke', () => {
      const sessionUser = { id: userId, email };
      const token = auth.issueRefreshSession(sessionUser);
      auth.revokeUserRefreshSessions(userId);
      expect(() => auth.rotateRefreshSession(token)).to.throw(/refresh_revoked/);
    });
  });
});
