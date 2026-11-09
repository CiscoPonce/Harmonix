const jpeg = require('jpeg-js');
const db = require('../db');

const RESERVED = ['admin', 'harmonix', 'support', 'hello'];
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from('IEND', 'ascii');
const RIFF_MAGIC = Buffer.from('RIFF', 'ascii');
const WEBP_MAGIC = Buffer.from('WEBP', 'ascii');

class ProfileError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
    this.status = status;
  }
}

function normalizeUsername(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ProfileError(
      'username_invalid',
      400,
      'Use 3–20 letters, numbers, or underscores.',
    );
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return null;
  if (!USERNAME_RE.test(normalized) || RESERVED.includes(normalized)) {
    throw new ProfileError(
      'username_invalid',
      400,
      'Use 3–20 letters, numbers, or underscores.',
    );
  }
  return normalized;
}

function normalizeBio(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ProfileError(
      'bio_invalid',
      400,
      'Bio must be 160 characters or fewer, with no markup.',
    );
  }
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 && value[i] !== ' ') {
      throw new ProfileError(
        'bio_invalid',
        400,
        'Bio must be 160 characters or fewer, with no markup.',
      );
    }
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 160) {
    throw new ProfileError(
      'bio_invalid',
      400,
      'Bio must be 160 characters or fewer, with no markup.',
    );
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 32 || code === 60 || code === 62) {
      throw new ProfileError(
        'bio_invalid',
        400,
        'Bio must be 160 characters or fewer, with no markup.',
      );
    }
  }
  return trimmed;
}

function readProfile(userId) {
  const row = db
    .prepare(
      `SELECT u.username, u.bio,
              EXISTS(SELECT 1 FROM user_avatars a WHERE a.user_id = u.id) AS has_avatar
       FROM users u
       WHERE u.id = ?`,
    )
    .get(userId);
  if (!row) return null;
  return {
    username: row.username ?? null,
    bio: row.bio ?? null,
    has_avatar: Boolean(row.has_avatar),
  };
}

function saveProfile(userId, patch = {}) {
  const hasUsername = Object.prototype.hasOwnProperty.call(patch, 'username');
  const hasBio = Object.prototype.hasOwnProperty.call(patch, 'bio');

  const updates = [];
  const params = [];

  if (hasUsername) {
    updates.push('username = ?');
    params.push(normalizeUsername(patch.username));
  }
  if (hasBio) {
    updates.push('bio = ?');
    params.push(normalizeBio(patch.bio));
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);
    try {
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    } catch (err) {
      if (
        err &&
        (err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
          String(err.message || '').includes('UNIQUE constraint failed'))
      ) {
        throw new ProfileError('username_taken', 409, 'That username is taken.');
      }
      throw err;
    }
  }

  return readProfile(userId);
}

function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    try {
      const decoded = jpeg.decode(buffer, { useTArray: true });
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        return 'image/jpeg';
      }
    } catch {
      return null;
    }
    return null;
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 8).equals(PNG_MAGIC) &&
    buffer.includes(PNG_IEND)
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(RIFF_MAGIC) &&
    buffer.subarray(8, 12).equals(WEBP_MAGIC)
  ) {
    return 'image/webp';
  }

  return null;
}

function saveAvatar(userId, buffer) {
  const sniffed = sniffImage(buffer);
  if (!sniffed) {
    throw new ProfileError(
      'avatar_invalid',
      400,
      'Use a JPEG, PNG, or WebP image under 512 KB.',
    );
  }
  db.prepare(
    `INSERT INTO user_avatars (user_id, bytes, mime, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       bytes = excluded.bytes,
       mime = excluded.mime,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(userId, buffer, sniffed);
}

function readAvatar(userId) {
  const row = db
    .prepare('SELECT bytes, mime FROM user_avatars WHERE user_id = ?')
    .get(userId);
  if (!row) return null;
  return {
    bytes: row.bytes,
    mime: row.mime,
  };
}

function deleteAvatar(userId) {
  db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(userId);
}

const deleteAccountTxn = db.transaction((userId) => {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!existing) return false;

  db.prepare(
    'DELETE FROM quiz_answers WHERE session_id IN (SELECT id FROM quiz_sessions WHERE user_id = ?)',
  ).run(userId);
  db.prepare('DELETE FROM quiz_sessions WHERE user_id = ?').run(userId);
  db.prepare(
    'DELETE FROM playlist_songs WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)',
  ).run(userId);
  db.prepare('DELETE FROM playlists WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_badges WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_vocab_progress WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM daily_words WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_word_queue WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_queue_refill WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_spotify_profiles WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM spotify_oauth_transactions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_spotify_tokens WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_spotify_playlists WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM spotify_export_jobs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM shared_postcards WHERE user_id = ?').run(userId);
  db.prepare('UPDATE usage_events SET user_id = NULL WHERE user_id = ?').run(userId);
  const res = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return res.changes > 0;
});

function deleteAccount(userId) {
  if (!userId) return false;
  return deleteAccountTxn(userId);
}

module.exports = {
  RESERVED,
  ProfileError,
  normalizeUsername,
  normalizeBio,
  saveProfile,
  readProfile,
  saveAvatar,
  readAvatar,
  deleteAvatar,
  deleteAccount,
  sniffImage,
};
