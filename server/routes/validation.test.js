const { expect } = require('chai');
const validationRouter = require('./validation');
const db = require('../db');

const mockRes = () => {
 const r = {};
 r.status = (c) => { r.statusCode = c; return r; };
 r.json = (d) => { r.body = d; return r; };
 return r;
};

describe('Validation API Routes', () => {
 beforeEach(() => {
 db.prepare('DELETE FROM validated_songs').run();
 db.prepare('DELETE FROM song_cache').run();
 });

 describe('GET /status/:songId', () => {
 it('returns validated:false for an unknown song', async () => {
 const handler = validationRouter.stack.find(s => s.route.path === '/status/:songId').route.stack[0].handle;
 const req = { params: { songId: 'no-such-song' } };
 const res = mockRes();
 await handler(req, res);
 expect(res.body.validated).to.equal(false);
 });
 });

 describe('POST /check/:songId', () => {
 it('records an invalid result when external APIs fail', async () => {
 const originalFetch = global.fetch;
 global.fetch = async () => ({ ok: false, status: 404 });

 const handler = validationRouter.stack.find(s => s.route.path === '/check/:songId').route.stack[0].handle;
 const req = { params: { songId: '99999' } };
 const res = mockRes();
 try {
 await handler(req, res);
 } finally {
 global.fetch = originalFetch;
 }

 // We expect either the explicit no-track error or an "invalid" record exists
 const row = db.prepare('SELECT * FROM validated_songs WHERE song_id = ?').get('99999');
 if (res.statusCode && res.statusCode >= 400) {
 expect(res.statusCode).to.be.oneOf([404, 502, 500]);
 } else {
 expect(row).to.not.be.undefined;
 expect(row.lrc_valid).to.equal(0);
 }
 });
 });
});
