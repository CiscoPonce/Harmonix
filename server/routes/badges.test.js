const { expect } = require('chai');
const badgesRouter = require('./badges');
const db = require('../db');

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  return r;
};

describe('Badge API Routes', () => {
  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
  }

  beforeEach(() => {
    ensureUser('bg-new');
    ensureUser('bg-unlocked');
    db.prepare('DELETE FROM user_badges').run();
  });

  describe('GET /', () => {
    it('returns all 5 badges with unlocked=0 for new user', () => {
      const handler = badgesRouter.stack.find(s => s.route.path === '/' && s.route.methods.get).route.stack[0].handle;
      const req = { user: { id: 'bg-new' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body.badges).to.have.lengthOf(5);
      for (const badge of res.body.badges) {
        expect(badge.unlocked).to.equal(0);
      }
    });

    it('shows unlocked=1 with unlocked_at when badge is earned', () => {
      const handler = badgesRouter.stack.find(s => s.route.path === '/' && s.route.methods.get).route.stack[0].handle;
      db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)').run('bg-unlocked', 'streak_7');
      const req = { user: { id: 'bg-unlocked' } };
      const res = mockRes();
      handler(req, res);
      const streak = res.body.badges.find(b => b.id === 'streak_7');
      expect(streak.unlocked).to.equal(1);
      expect(streak.unlocked_at).to.exist;
    });
  });
});
