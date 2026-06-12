const { expect } = require('chai');
const auth = require('./auth');

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

    it('should generate a valid refresh token', () => {
      const token = auth.generateRefreshToken(user);
      const payload = auth.verifyRefreshToken(token);
      expect(payload.id).to.equal(user.id);
      expect(payload.email).to.equal(user.email);
    });

    it('should throw error for invalid access token', () => {
      expect(() => auth.verifyAccessToken('invalid-token')).to.throw();
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => auth.verifyRefreshToken('invalid-token')).to.throw();
    });
  });
});
