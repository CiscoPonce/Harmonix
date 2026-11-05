const { expect } = require('chai');
const { Writable } = require('stream');
const audioRouter = require('./audio');
const deezer = require('../services/deezerService');
const validation = require('../services/validationService');

const handler = audioRouter.stack.find((s) => s.route.path === '/preview/:trackId').route.stack[0].handle;

const mockRes = () => {
  const chunks = [];
  const r = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  r.headers = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; r.end(); return r; };
  r.setHeader = (name, value) => { r.headers[name.toLowerCase()] = value; };
  r.done = new Promise((resolve) => r.on('finish', resolve));
  r.text = () => Buffer.concat(chunks).toString();
  return r;
};

describe('Audio preview route', () => {
  const originals = {};
  let fetchCalls;

  beforeEach(() => {
    originals.fetch = global.fetch;
    originals.getCachedSong = validation.getCachedSong;
    originals.resolvePreviewForTrackId = deezer.resolvePreviewForTrackId;
    originals.searchItunesTrack = deezer.searchItunesTrack;
    fetchCalls = [];
  });

  afterEach(() => {
    global.fetch = originals.fetch;
    validation.getCachedSong = originals.getCachedSong;
    deezer.resolvePreviewForTrackId = originals.resolvePreviewForTrackId;
    deezer.searchItunesTrack = originals.searchItunesTrack;
  });

  it('does not fetch a cached preview on a non-allowlisted host', async () => {
    validation.getCachedSong = () => ({ track: { preview: 'https://169.254.169.254/x' } });
    global.fetch = async (url) => {
      fetchCalls.push(String(url));
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const res = mockRes();
    await handler({ params: { trackId: '123' }, query: {}, headers: {} }, res);
    expect(res.statusCode).to.equal(404);
    expect(fetchCalls).to.not.include('https://169.254.169.254/x');
  });

  it('refuses a resolved preview URL outside the allowlist without fetching it', async () => {
    validation.getCachedSong = () => null;
    deezer.resolvePreviewForTrackId = async () => ({ previewUrl: 'http://127.0.0.1:3002/x', track: null });
    global.fetch = async (url) => {
      fetchCalls.push(String(url));
      return { ok: true, status: 200 };
    };
    const res = mockRes();
    await handler({ params: { trackId: '123' }, query: {}, headers: {} }, res);
    expect(res.statusCode).to.equal(404);
    expect(res.body).to.deep.equal({ error: 'no_preview' });
    expect(fetchCalls).to.deep.equal([]);
  });

  it('refuses an iTunes fallback preview outside the allowlist', async () => {
    validation.getCachedSong = () => null;
    deezer.resolvePreviewForTrackId = async () => ({
      previewUrl: 'https://cdnt-preview.dzcdn.net/x.mp3',
      track: null,
    });
    deezer.searchItunesTrack = async () => ({ preview: 'https://169.254.169.254/x' });
    global.fetch = async (url) => {
      fetchCalls.push(String(url));
      return { ok: false, status: 403 };
    };
    const res = mockRes();
    await handler({ params: { trackId: '123' }, query: { artist: 'A', title: 'T' }, headers: {} }, res);
    expect(res.statusCode).to.equal(404);
    expect(res.body).to.deep.equal({ error: 'no_preview' });
    expect(fetchCalls).to.deep.equal(['https://cdnt-preview.dzcdn.net/x.mp3']);
  });

  it('streams an allowlisted Deezer preview', async () => {
    const previewUrl = 'https://cdnt-preview.dzcdn.net/x.mp3';
    validation.getCachedSong = () => ({ track: { preview: previewUrl } });
    global.fetch = async (url) => {
      fetchCalls.push(String(url));
      if (String(url) === previewUrl) {
        return new Response('mp3', { status: 200, headers: { 'content-type': 'audio/mpeg' } });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const res = mockRes();
    await handler({ params: { trackId: '123' }, query: {}, headers: {} }, res);
    await res.done;
    expect(res.statusCode).to.equal(200);
    expect(res.headers['content-type']).to.equal('audio/mpeg');
    expect(res.text()).to.equal('mp3');
    expect(fetchCalls).to.include(previewUrl);
  });
});
