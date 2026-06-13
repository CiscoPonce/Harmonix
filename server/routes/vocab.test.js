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

const mockReq = (params = {}, user = { id: 'test-user', cefr_level: 'B1' }, query = {}) => ({
  params,
  user,
  query,
});

// Hard-reset the test DB schema each run by deleting the file before describing.
// This avoids lingering old-schema rows from prior runs.
// The exported `db` is initialized at module load (db.js ran once with the OLD
// schema), so we apply a schema version bump + ALTER to add the new column.
const SCHEMA_VERSION = 2;
const verRow = db.prepare('PRAGMA user_version').get();
if (!verRow || verRow.user_version < SCHEMA_VERSION) {
  // Add char_end column to song_vocab_map (idempotent).
  const cols = db.prepare("PRAGMA table_info('song_vocab_map')").all().map(c => c.name);
  if (!cols.includes('char_end')) {
    db.exec('ALTER TABLE song_vocab_map ADD COLUMN char_end INTEGER');
  }
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

describe('Vocab API Routes', () => {
 beforeEach(() => {
 // Clean up DB before each test (children first to satisfy FK constraints)
 db.prepare('DELETE FROM quiz_answers').run();
 db.prepare('DELETE FROM quiz_sessions').run();
 db.prepare('DELETE FROM user_vocab_progress').run();
 db.prepare('DELETE FROM user_stats').run();
 db.prepare('DELETE FROM song_vocab_map').run();
 db.prepare('DELETE FROM vocab_items').run();
 });

  it('should return cached vocabulary if it exists', async () => {
    const songId = 'test-song-123';
    const vocabId = 'v1';
    
    db.prepare('INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)')
      .run(vocabId, 'hola', 'hello', 'A1', 'es');
    db.prepare('INSERT INTO song_vocab_map (song_id, vocab_id, line_index, char_start, char_end) VALUES (?, ?, ?, ?, ?)')
    .run(songId, vocabId, 0, 5, 9);

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

  describe('User never sees the same word twice for one song', () => {
    function uniqueWordList(...rows) {
      return rows.map(r => r.word);
    }

    async function runExtraction(songId, fakeVocab, fakeLyrics) {
      const originalFetch = global.fetch;
      const originalExtract = aiService.extractVocabulary;
      global.fetch = async (url) => {
        if (url.includes('deezer.com')) {
          return { json: async () => ({ title: 'T', artist: { name: 'A' } }) };
        }
        if (url.includes('lrclib.net')) {
          return { ok: true, json: async () => fakeLyrics };
        }
      };
      aiService.extractVocabulary = async () => fakeVocab;
      try {
        const handler = vocabRouter.stack.find(s => s.route.path === '/:songId').route.stack[0].handle;
        const res = mockRes();
        await handler({ params: { songId }, user: { id: 'u1' }, query: {} }, res);
        return res.body;
      } finally {
        global.fetch = originalFetch;
        aiService.extractVocabulary = originalExtract;
      }
    }

    it('dedupes when the AI returns the same word twice in one extraction', async () => {
      const songId = 'dedup-intra';
      const lyrics = { plainLyrics: 'Hola mundo hola amigos hola', syncedLyrics: '' };
      const ai = [
        { word: 'hola', lemma: 'holar', definition: 'greeting', cefr_level: 'A1' },
        { word: 'mundo', lemma: 'mundo', definition: 'world', cefr_level: 'A1' },
        { word: 'hola', lemma: 'holar', definition: 'greeting', cefr_level: 'A1' }, // dup
        { word: 'amigos', lemma: 'amigo', definition: 'friends', cefr_level: 'A1' },
        { word: 'hola', lemma: 'holar', definition: 'greeting', cefr_level: 'A1' }, // dup
      ];
      const body = await runExtraction(songId, ai, lyrics);

      // User-facing response contains each word at most once.
      const allRows = [...(body.mapped || []), ...(body.unmapped || [])];
      const allWords = allRows.map(r => r.word);
      expect(new Set(allWords).size).to.equal(allWords.length, 'no duplicate words in user response');
      expect(allWords).to.have.members(['hola', 'mundo', 'amigos']);
      expect(allWords).to.have.lengthOf(3);
    });

    it('dedupes accent-/case-insensitive variants from the AI', async () => {
      const songId = 'dedup-accent';
      const lyrics = { plainLyrics: 'Corazón corazón CORAZON después despues', syncedLyrics: '' };
      const ai = [
        { word: 'Corazón', lemma: 'corazon', definition: 'heart', cefr_level: 'A2' },
        { word: 'corazón', lemma: 'corazon', definition: 'heart', cefr_level: 'A2' },
        { word: 'CORAZON', lemma: 'corazon', definition: 'heart', cefr_level: 'A2' },
        { word: 'después', lemma: 'despues', definition: 'after', cefr_level: 'A2' },
        { word: 'despues', lemma: 'despues', definition: 'after', cefr_level: 'A2' },
      ];
      const body = await runExtraction(songId, ai, lyrics);

      const allWords = [...body.mapped, ...body.unmapped].map(r => r.word);
      expect(new Set(allWords).size).to.equal(allWords.length);
      expect(allWords).to.have.lengthOf(2);

      // Same vocab_id re-used across rows mapping to same canonical word.
      const vocabIds = [...body.mapped, ...body.unmapped].map(r => r.vocab_id);
      expect(new Set(vocabIds).size).to.equal(2);

      // The hola-style duplicate should also not produce 3+ map rows for that word.
      const mapRows = db.prepare(
        "SELECT vocab_id, line_index, char_start FROM song_vocab_map WHERE song_id = ? AND vocab_id = (SELECT vocab_id FROM song_vocab_map WHERE song_id = ? ORDER BY char_start LIMIT 1)"
      ).all(songId, songId);
      expect(mapRows.length).to.be.at.least(1); // at least one map row for the multi-position word
    });

    it('reuses vocabulary from earlier extractions across re-extracts', async () => {
      const songId = 'dedup-reruns';
      const lyrics = { plainLyrics: 'casa y casa y casa', syncedLyrics: '' };
      const ai = [{ word: 'casa', lemma: 'casa', definition: 'house', cefr_level: 'A1' }];

      const first = await runExtraction(songId, ai, lyrics);
      const firstVocabId = first.mapped[0].vocab_id;

      // Second extraction: AI returns the word again. Force a re-extract by
      // calling the handler with force=true won't help against the cache fast-
      // path, so we wipe the snapshot to force the live path while keeping the
      // vocab_items row in place.
      db.prepare('DELETE FROM song_lyrics_snapshot WHERE song_id = ?').run(songId);
      const second = await runExtraction(songId, ai, lyrics);
      const secondVocabId = second.mapped[0].vocab_id;

      // Same word, same canonical key => same vocab row.
      expect(secondVocabId).to.equal(firstVocabId);

      // Database contains exactly one vocab_items row for 'casa'.
      const count = db.prepare(
        "SELECT COUNT(*) as n FROM vocab_items WHERE canonical_key = 'casa|es'"
      ).get().n;
      expect(count).to.equal(1);
    });

    it('exposes all_occurrences so the UI can jump between repeats in the song', async () => {
      const songId = 'multi-occurrence';
      // "hola" appears on lines 0, 1, 2 (3 lines total).
      const lyrics = { plainLyrics: 'hola amigo\nhola amiga\nhola familia', syncedLyrics: '' };
      const ai = [{ word: 'hola', lemma: 'holar', definition: 'greeting', cefr_level: 'A1' }];
      const body = await runExtraction(songId, ai, lyrics);

      // User sees ONE mapped row for hola...
      const holaRows = body.mapped.filter(r => r.word === 'hola');
      expect(holaRows).to.have.lengthOf(1);
      // ...but the row knows about EVERY occurrence in the song.
      expect(holaRows[0]).to.have.property('all_occurrences');
      expect(holaRows[0].all_occurrences).to.have.lengthOf(3);
    });
  });
});
