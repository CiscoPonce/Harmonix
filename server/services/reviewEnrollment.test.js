const { expect } = require('chai');
const db = require('../db');
const { enrollDailyWord } = require('./reviewEnrollment');

function payload(word, translation, lang = 'es') {
  return {
    language_code: lang,
    word: { text: word, translation },
    lyric: { snippet: `line with ${word}` },
    song: { title: 'Song', artist: 'Artist' },
  };
}

describe('review enrollment', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM user_vocab_progress').run();
    db.prepare('DELETE FROM vocab_items').run();
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run('u1', 'u1@test.com', 'x');
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run('u2', 'u2@test.com', 'x');
  });

  it('creates a vocab row and a progress row due tomorrow', () => {
    const id = enrollDailyWord('u1', payload('amor', 'love'));
    expect(id).to.be.a('string');
    expect(db.prepare('SELECT COUNT(*) AS n FROM vocab_items').get().n).to.equal(1);
    const progress = db.prepare('SELECT * FROM user_vocab_progress WHERE user_id = ?').get('u1');
    expect(progress.gloss).to.equal('love');
    expect(progress.source).to.equal('daily_word');
    const tomorrow = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() + 1
    )).toISOString();
    expect(progress.next_review).to.equal(tomorrow);
  });

  it('does not reset review state when the same word is delivered again', () => {
    enrollDailyWord('u1', payload('amor', 'love'));
    db.prepare(`
      UPDATE user_vocab_progress SET reps = 4, next_review = '2020-01-01T00:00:00.000Z' WHERE user_id = 'u1'
    `).run();
    enrollDailyWord('u1', payload('amor', 'love'));
    const progress = db.prepare('SELECT reps, next_review FROM user_vocab_progress WHERE user_id = ?').get('u1');
    expect(progress.reps).to.equal(4);
    expect(progress.next_review).to.equal('2020-01-01T00:00:00.000Z');
    expect(db.prepare('SELECT COUNT(*) AS n FROM vocab_items').get().n).to.equal(1);
  });

  it('reuses the vocab row and keeps each learner gloss', () => {
    enrollDailyWord('u1', payload('amor', 'love'));
    enrollDailyWord('u2', payload('amor', 'amour'));
    expect(db.prepare('SELECT COUNT(*) AS n FROM vocab_items').get().n).to.equal(1);
    expect(db.prepare('SELECT gloss FROM user_vocab_progress WHERE user_id = ?').get('u1').gloss).to.equal('love');
    expect(db.prepare('SELECT gloss FROM user_vocab_progress WHERE user_id = ?').get('u2').gloss).to.equal('amour');
  });

  it('folds accents into one vocab row', () => {
    enrollDailyWord('u1', payload('corazón', 'heart'));
    enrollDailyWord('u2', payload('corazon', 'heart'));
    expect(db.prepare('SELECT COUNT(*) AS n FROM vocab_items').get().n).to.equal(1);
  });

  it('writes nothing when the word is missing', () => {
    expect(enrollDailyWord('u1', { language_code: 'es', word: {} })).to.equal(null);
    expect(db.prepare('SELECT COUNT(*) AS n FROM vocab_items').get().n).to.equal(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM user_vocab_progress').get().n).to.equal(0);
  });
});
