const { expect } = require('chai');
const playlistsRouter = require('./playlists');
const db = require('../db');
const { nanoid } = require('nanoid');

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  return r;
};

describe('Playlist API Routes', () => {
  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
  }

  beforeEach(() => {
    ensureUser('pl-owner');
    ensureUser('pl-other');
    db.prepare('DELETE FROM user_badges').run();
    db.prepare('DELETE FROM playlist_songs').run();
    db.prepare('DELETE FROM playlists').run();
  });

  describe('POST /', () => {
    it('creates a playlist and returns 201', () => {
      const handler = playlistsRouter.stack.find(s => s.route.path === '/' && s.route.methods.post).route.stack[0].handle;
      const req = { body: { name: 'My Favorites' }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).to.equal(201);
      expect(res.body.playlist).to.have.property('id');
      expect(res.body.playlist.name).to.equal('My Favorites');
    });

    it('returns 400 for empty name', () => {
      const handler = playlistsRouter.stack.find(s => s.route.path === '/' && s.route.methods.post).route.stack[0].handle;
      const req = { body: { name: '   ' }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('GET /', () => {
    it('lists playlists for the user', () => {
      const pid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'Test List');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/' && s.route.methods.get).route.stack[0].handle;
      const req = { user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body.playlists).to.have.lengthOf(1);
      expect(res.body.playlists[0].name).to.equal('Test List');
    });
  });

  describe('GET /:id', () => {
    it('returns playlist with songs', () => {
      const pid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'Detail Test');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id' && s.route.methods.get).route.stack[0].handle;
      const req = { params: { id: pid }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body.name).to.equal('Detail Test');
      expect(res.body.songs).to.be.an('array');
    });

    it('returns 404 for non-existent playlist', () => {
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id' && s.route.methods.get).route.stack[0].handle;
      const req = { params: { id: 'nonexistent' }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).to.equal(404);
    });

    it('returns 404 for another user\'s playlist', () => {
      const pid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'Owned');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id' && s.route.methods.get).route.stack[0].handle;
      const req = { params: { id: pid }, user: { id: 'pl-other' } };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).to.equal(404);
    });
  });

  describe('PUT /:id', () => {
    it('renames a playlist', () => {
      const pid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'Old Name');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id' && s.route.methods.put).route.stack[0].handle;
      const req = { params: { id: pid }, body: { name: 'New Name' }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body.playlist.name).to.equal('New Name');
    });
  });

  describe('DELETE /:id', () => {
    it('deletes a playlist', () => {
      const pid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'To Delete');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id' && s.route.methods.delete).route.stack[0].handle;
      const req = { params: { id: pid }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body).to.have.property('message');
      const row = db.prepare('SELECT * FROM playlists WHERE id = ?').get(pid);
      expect(row).to.be.undefined;
    });
  });

  describe('POST /:id/songs', () => {
    it('adds a song to a playlist', () => {
      const pid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'Songs');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id/songs' && s.route.methods.post).route.stack[0].handle;
      const req = { params: { id: pid }, body: { song_id: '12345' }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).to.equal(201);
      expect(res.body.entry.playlist_id).to.equal(pid);
    });
  });

  describe('DELETE /:id/songs/:songId', () => {
    it('removes a song from a playlist', () => {
      const pid = nanoid();
      const eid = nanoid();
      db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(pid, 'pl-owner', 'Remove');
      db.prepare('INSERT INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)').run(eid, pid, '99');
      const handler = playlistsRouter.stack.find(s => s.route.path === '/:id/songs/:songId' && s.route.methods.delete).route.stack[0].handle;
      const req = { params: { id: pid, songId: '99' }, user: { id: 'pl-owner' } };
      const res = mockRes();
      handler(req, res);
      expect(res.body).to.have.property('message');
    });
  });
});
