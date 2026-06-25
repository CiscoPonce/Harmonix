const { expect } = require('chai');
const badgeService = require('./badgeService');
const db = require('../db');

describe('Badge Service', () => {
  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
  }

  beforeEach(() => {
    ensureUser('bs-empty');
    ensureUser('bs-streak');
    ensureUser('bs-playlist');
    ensureUser('bs-already');
    db.prepare('DELETE FROM user_badges').run();
    db.prepare('DELETE FROM playlist_songs').run();
    db.prepare('DELETE FROM playlists').run();
    db.prepare('DELETE FROM user_stats').run();
  });

  it('returns empty array when user has no achievements', () => {
    const result = badgeService.checkAndUnlockBadges('bs-empty');
    expect(result).to.be.an('array').that.is.empty;
  });

  it('unlocks streak_7 when user_stats.streak_days >= 7', () => {
    db.prepare('INSERT INTO user_stats (user_id, streak_days) VALUES (?, ?)').run('bs-streak', 7);
    const result = badgeService.checkAndUnlockBadges('bs-streak');
    const badge = result.find(b => b.id === 'streak_7');
    expect(badge).to.exist;
    expect(badge.name).to.equal('7-Day Streak');
  });

  it('unlocks playlist_first when a playlist exists', () => {
    const { nanoid } = require('nanoid');
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(nanoid(), 'bs-playlist', 'Test');
    const result = badgeService.checkAndUnlockBadges('bs-playlist');
    const badge = result.find(b => b.id === 'playlist_first');
    expect(badge).to.exist;
    expect(badge.name).to.equal('Curator');
  });

  it('returns empty for already unlocked badges', () => {
    const { nanoid } = require('nanoid');
    db.prepare('INSERT INTO user_stats (user_id, streak_days) VALUES (?, ?)').run('bs-already', 7);
    db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)').run('bs-already', 'streak_7');
    const result = badgeService.checkAndUnlockBadges('bs-already');
    expect(result.find(b => b.id === 'streak_7')).to.not.exist;
  });
});
