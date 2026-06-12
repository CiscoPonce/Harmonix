const { expect } = require('chai');
const db = require('../db');
const vocabRouter = require('./vocab');
const aiService = require('../services/aiService');

// Mock request/response
const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

const mockReq = (params = {}, user = { id: 'test-user', cefr_level: 'B1' }) => ({
  params,
  user
});

describe('Vocab API Routes', () => {
  beforeEach(() => {
    // Clean up DB before each test
    db.prepare('DELETE FROM song_vocab_map').run();
    db.prepare('DELETE FROM vocab_items').run();
  });

  it('should return cached vocabulary if it exists', async () => {
    const songId = 'test-song-123';
    const vocabId = 'v1';
    
    db.prepare('INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)')
      .run(vocabId, 'hola', 'hello', 'A1', 'es');
    db.prepare('INSERT INTO song_vocab_map (song_id, vocab_id, line_index, char_start) VALUES (?, ?, ?, ?)')
      .run(songId, vocabId, 0, 5);

    const req = mockReq({ songId });
    const res = mockRes();

    // Use the router's handler directly for testing logic without full HTTP overhead if possible,
    // but the router is an express router. We'll find the handler.
    const handler = vocabRouter.stack.find(s => s.route.path === '/:songId').route.stack[0].handle;

    await handler(req, res);

    expect(res.body).to.have.property('mapped');
    expect(res.body.mapped).to.have.lengthOf(1);
    expect(res.body.mapped[0].word).to.equal('hola');
    expect(res.body.unmapped).to.have.lengthOf(0);
  });

  it('should extract and save vocabulary if not cached', async () => {
    const songId = 'new-song-456';
    
    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('deezer.com')) {
        return { json: async () => ({ title: 'Test Song', artist: { name: 'Test Artist' } }) };
      }
      if (url.includes('lrclib.net')) {
        return { 
          ok: true, 
          json: async () => ({ plainLyrics: 'Hola mundo\nAdiós amigos' }) 
        };
      }
    };

    // Mock AI service
    const originalExtract = aiService.extractVocabulary;
    aiService.extractVocabulary = async () => [
      { word: 'Hola', lemma: 'hola', definition: 'hello', cefr_level: 'A1' },
      { word: 'Amigos', lemma: 'amigo', definition: 'friends', cefr_level: 'A1' },
      { word: 'Unmapped', lemma: 'unmapped', definition: 'not in lyrics', cefr_level: 'B2' }
    ];

    const req = mockReq({ songId });
    const res = mockRes();
    const handler = vocabRouter.stack.find(s => s.route.path === '/:songId').route.stack[0].handle;

    await handler(req, res);

    // Restore mocks
    global.fetch = originalFetch;
    aiService.extractVocabulary = originalExtract;

    expect(res.body.mapped).to.have.length.at.least(2);
    expect(res.body.unmapped).to.have.lengthOf(1);
    expect(res.body.unmapped[0].word).to.equal('Unmapped');

    // Verify DB
    const count = db.prepare('SELECT count(*) as count FROM vocab_items').get().count;
    expect(count).to.equal(3);
    
    const mapCount = db.prepare('SELECT count(*) as count FROM song_vocab_map WHERE song_id = ?').get(songId).count;
    // 2 mapped + 1 unmapped = 3 entries in song_vocab_map (unmapped has -1, -1)
    expect(mapCount).to.equal(3);
  });
});
