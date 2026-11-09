const { expect } = require('chai');
const jpeg = require('jpeg-js');
const db = require('../db');
const profileService = require('./profileService');

describe('Profile Service', () => {
  const userIds = ['ps-user-1', 'ps-user-2'];

  beforeEach(() => {
    for (const id of userIds) {
      db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
        id,
        `${id}@example.com`,
        'hash',
      );
    }
  });

  after(() => {
    for (const id of userIds) {
      db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
  });

  it('lowercases a valid username and saves it', () => {
    const profile = profileService.saveProfile('ps-user-1', { username: '  Ada_1  ' });
    expect(profile.username).to.equal('ada_1');
    expect(profile.bio).to.equal(null);
    expect(profile.has_avatar).to.equal(false);
  });

  it('rejects a short username like Ab', () => {
    expect(() => profileService.normalizeUsername('Ab')).to.throw(
      'Use 3–20 letters, numbers, or underscores.',
    );
  });

  it('rejects reserved usernames like admin', () => {
    for (const reserved of profileService.RESERVED) {
      expect(() => profileService.normalizeUsername(reserved.toUpperCase())).to.throw(
        'Use 3–20 letters, numbers, or underscores.',
      );
    }
  });

  it('rejects a bio of 161 characters', () => {
    const longBio = 'a'.repeat(161);
    expect(() => profileService.normalizeBio(longBio)).to.throw(
      'Bio must be 160 characters or fewer, with no markup.',
    );
  });

  it('rejects a bio with < or > or control characters', () => {
    expect(() => profileService.normalizeBio('Hello <script>')).to.throw(
      'Bio must be 160 characters or fewer, with no markup.',
    );
    expect(() => profileService.normalizeBio('Hello > world')).to.throw(
      'Bio must be 160 characters or fewer, with no markup.',
    );
    expect(() => profileService.normalizeBio('Line 1\nLine 2')).to.throw(
      'Bio must be 160 characters or fewer, with no markup.',
    );
  });

  it('clears username and bio when given an empty string', () => {
    profileService.saveProfile('ps-user-1', {
      username: 'learner_one',
      bio: 'Learning Spanish through songs',
    });
    const cleared = profileService.saveProfile('ps-user-1', {
      username: '   ',
      bio: '',
    });
    expect(cleared.username).to.equal(null);
    expect(cleared.bio).to.equal(null);
  });

  it('prevents a second user from taking the same username', () => {
    profileService.saveProfile('ps-user-1', { username: 'same_handle' });
    let caught = null;
    try {
      profileService.saveProfile('ps-user-2', { username: 'SAME_HANDLE' });
    } catch (err) {
      caught = err;
    }
    expect(caught).to.exist;
    expect(caught.code).to.equal('username_taken');
    expect(caught.status).to.equal(409);
  });

  it('accepts a 1x1 JPEG from jpeg-js encode and stores/deletes avatar', () => {
    const raw = {
      data: Buffer.from([255, 0, 0, 255]),
      width: 1,
      height: 1,
    };
    const encoded = jpeg.encode(raw, 80).data;
    expect(profileService.sniffImage(encoded)).to.equal('image/jpeg');

    profileService.saveAvatar('ps-user-1', encoded, 'image/jpeg');
    expect(profileService.readProfile('ps-user-1').has_avatar).to.equal(true);
    const loaded = profileService.readAvatar('ps-user-1');
    expect(loaded.mime).to.equal('image/jpeg');
    expect(Buffer.compare(loaded.bytes, encoded)).to.equal(0);

    profileService.deleteAvatar('ps-user-1');
    expect(profileService.readAvatar('ps-user-1')).to.equal(null);
    expect(profileService.readProfile('ps-user-1').has_avatar).to.equal(false);
  });

  it('rejects a buffer starting with <html', () => {
    const htmlBuf = Buffer.from('<html><body>not an image</body></html>', 'utf8');
    expect(profileService.sniffImage(htmlBuf)).to.equal(null);
  });

  it('accepts PNG and WebP magic headers of the right shape', () => {
    const pngBuf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('IEND', 'ascii'),
    ]);
    expect(profileService.sniffImage(pngBuf)).to.equal('image/png');

    const webpBuf = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'ascii');
    expect(profileService.sniffImage(webpBuf)).to.equal('image/webp');
  });

  it('rejects a truncated JPEG (FF D8 FF plus garbage)', () => {
    const badJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(profileService.sniffImage(badJpeg)).to.equal(null);
  });

  it('deletes an account and all dependent rows cleanly', () => {
    const encoded = jpeg.encode(
      { data: Buffer.from([255, 0, 0, 255]), width: 1, height: 1 },
      80,
    ).data;
    profileService.saveProfile('ps-user-1', { username: 'bye_user', bio: 'Temporary' });
    profileService.saveAvatar('ps-user-1', encoded);
    db.prepare('INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)').run(
      'ps-user-1',
      '2026-11-08',
      '{"word":"hola"}',
    );
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      'pl-del-1',
      'ps-user-1',
      'My Songs',
    );
    db.prepare('INSERT INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)').run(
      'pls-del-1',
      'pl-del-1',
      'song-1',
    );

    const deleted = profileService.deleteAccount('ps-user-1');
    expect(deleted).to.equal(true);
    expect(profileService.readProfile('ps-user-1')).to.equal(null);
    expect(profileService.readAvatar('ps-user-1')).to.equal(null);
    expect(
      db.prepare('SELECT COUNT(*) as c FROM daily_words WHERE user_id = ?').get('ps-user-1').c,
    ).to.equal(0);
    expect(
      db.prepare('SELECT COUNT(*) as c FROM playlists WHERE user_id = ?').get('ps-user-1').c,
    ).to.equal(0);
    expect(profileService.deleteAccount('ps-user-1')).to.equal(false);
  });
});
