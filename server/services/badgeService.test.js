const { expect } = require('chai');
const { nanoid } = require('nanoid');
const badgeService = require('./badgeService');
const badgesRouter = require('../routes/badges');
const db = require('../db');

describe('Badge Service', () => {
  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      id,
      `${id}@test.com`,
      'x',
    );
  }

  beforeEach(() => {
    ensureUser('bs-empty');
    ensureUser('bs-streak');
    ensureUser('bs-gap');
    ensureUser('bs-vocab');
    ensureUser('bs-review');
    ensureUser('bs-playlist');
    ensureUser('bs-already');
    db.prepare('DELETE FROM user_badges').run();
    db.prepare('DELETE FROM daily_words').run();
    db.prepare('DELETE FROM quiz_answers').run();
    db.prepare('DELETE FROM user_vocab_progress').run();
    db.prepare('DELETE FROM song_vocab_map').run();
    db.prepare('DELETE FROM quiz_sessions').run();
    db.prepare('DELETE FROM vocab_items').run();
    db.prepare('DELETE FROM playlist_songs').run();
    db.prepare('DELETE FROM playlists').run();
    db.prepare('DELETE FROM user_stats').run();
  });

  it('returns empty array when user has no achievements', () => {
    const result = badgeService.checkAndUnlockBadges('bs-empty');
    expect(result).to.be.an('array').that.is.empty;
  });

  it('does not unlock streak_7 when user_stats.streak_days is 7 with only one daily_words row', () => {
    db.prepare('INSERT INTO user_stats (user_id, streak_days) VALUES (?, ?)').run('bs-streak', 7);
    db.prepare('INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)').run(
      'bs-streak',
      '2026-01-01',
      '{}',
    );
    const result = badgeService.checkAndUnlockBadges('bs-streak');
    expect(result.find((b) => b.id === 'streak_7')).to.not.exist;
  });

  it('unlocks daily_word_7 but not streak_7 for seven scattered dates with gaps', () => {
    const insert = db.prepare(
      'INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i * 2)).toISOString().slice(0, 10);
      insert.run('bs-gap', day, '{}');
    }
    const result = badgeService.checkAndUnlockBadges('bs-gap');
    expect(result.find((b) => b.id === 'daily_word_7')).to.exist;
    expect(result.find((b) => b.id === 'streak_7')).to.not.exist;
  });

  it('unlocks both streak_7 and daily_word_7 for seven consecutive dates', () => {
    const insert = db.prepare(
      'INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      insert.run('bs-streak', day, '{}');
    }
    const result = badgeService.checkAndUnlockBadges('bs-streak');
    const streakBadge = result.find((b) => b.id === 'streak_7');
    expect(streakBadge).to.exist;
    expect(streakBadge.name).to.equal('7-Day Streak');
    expect(result.find((b) => b.id === 'daily_word_7')).to.exist;
  });

  it('unlocks vocab_50 when 50 daily_words rows exist even with reps at 0', () => {
    const insert = db.prepare(
      'INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < 50; i += 1) {
      insert.run('bs-vocab', '2026-01-01', JSON.stringify({ idx: i }));
    }
    const result = badgeService.checkAndUnlockBadges('bs-vocab');
    const vocabBadge = result.find((b) => b.id === 'vocab_50');
    expect(vocabBadge).to.exist;
    expect(vocabBadge.name).to.equal('50 Words');
  });

  it('unlocks review_10 at 10 reviewed words and does not unlock vocab_50', () => {
    const insertVocab = db.prepare(
      'INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)',
    );
    const insertProg = db.prepare(
      'INSERT INTO user_vocab_progress (user_id, vocab_id, reps) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < 10; i += 1) {
      const vid = `rev-v-${i}`;
      insertVocab.run(vid, `word${i}`, 'def', 'A1', 'es');
      insertProg.run('bs-review', vid, 1);
    }
    const result = badgeService.checkAndUnlockBadges('bs-review');
    const reviewBadge = result.find((b) => b.id === 'review_10');
    expect(reviewBadge).to.exist;
    expect(reviewBadge.name).to.equal('10 Reviews');
    expect(result.find((b) => b.id === 'vocab_50')).to.not.exist;
  });

  it('unlocks playlist_first when a playlist exists', () => {
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      nanoid(),
      'bs-playlist',
      'Test',
    );
    const result = badgeService.checkAndUnlockBadges('bs-playlist');
    const badge = result.find((b) => b.id === 'playlist_first');
    expect(badge).to.exist;
    expect(badge.name).to.equal('Curator');
  });

  it('returns empty for already unlocked badges', () => {
    const insert = db.prepare(
      'INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      insert.run('bs-already', day, '{}');
    }
    db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(
      'bs-already',
      'streak_7',
    );
    const result = badgeService.checkAndUnlockBadges('bs-already');
    expect(result.find((b) => b.id === 'streak_7')).to.not.exist;
  });

  it('GET /api/badges omits quiz_perfect and includes progress and target', () => {
    db.prepare('INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)').run(
      'bs-empty',
      '2026-01-01',
      '{}',
    );
    const handler = badgesRouter.stack.find((s) => s.route && s.route.path === '/').route.stack[0]
      .handle;
    let body = null;
    const res = {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    handler({ user: { id: 'bs-empty' } }, res);
    expect(body).to.exist;
    expect(body.badges.find((b) => b.id === 'quiz_perfect')).to.not.exist;
    const daily7 = body.badges.find((b) => b.id === 'daily_word_7');
    expect(daily7).to.exist;
    expect(daily7.progress).to.equal(1);
    expect(daily7.target).to.equal(7);
  });
});
