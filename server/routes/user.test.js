const { expect } = require('chai');
const userRouter = require('./user');
const db = require('../db');

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  return r;
};

describe('User Preferences API Routes', () => {
  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
  }

  beforeEach(() => {
    ensureUser('up-test');
    ensureUser('up-partial');
  });

  describe('GET /preferences', () => {
    it('returns default preference values', () => {
      const handler = userRouter.stack.find(s => s.route.path === '/preferences' && s.route.methods.get).route.stack[0].handle;
      const req = { user: { id: 'up-test' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body).to.have.property('native_language', 'en');
      expect(res.body).to.have.property('target_language', 'es');
      expect(res.body).to.have.property('genre', 'pop');
      expect(res.body).to.have.property('difficulty', 'medium');
      expect(res.body).to.have.property('cefr_level', 'B1');
    });
  });

  describe('PATCH /preferences', () => {
    it('updates native_language and target_language', () => {
      const handler = userRouter.stack.find(s => s.route.path === '/preferences' && s.route.methods.patch).route.stack[0].handle;
      const req = { body: { native_language: 'en', target_language: 'fr' }, user: { id: 'up-test' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body.native_language).to.equal('en');
      expect(res.body.target_language).to.equal('fr');
    });

    it('rejects invalid target_language with 400', () => {
      const handler = userRouter.stack.find(s => s.route.path === '/preferences' && s.route.methods.patch).route.stack[0].handle;
      const req = { body: { target_language: 'invalid' }, user: { id: 'up-test' } };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).to.equal(400);
    });

    it('partial update does not clear other fields', () => {
      const handler = userRouter.stack.find(s => s.route.path === '/preferences' && s.route.methods.patch).route.stack[0].handle;
      let req = { body: { native_language: 'en', target_language: 'fr', difficulty: 'hard' }, user: { id: 'up-partial' } };
      let res = mockRes();
      handler(req, res);
      expect(res.body.difficulty).to.equal('hard');
      expect(res.body.genre).to.equal('pop');
    });
  });
});
