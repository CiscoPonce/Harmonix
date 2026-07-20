const crypto = require('crypto');

const KEY_ENV = 'SPOTIFY_TOKEN_ENCRYPTION_KEY';
const VERSION_ENV = 'SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION';
const EXPECTED_KEY_BYTES = 32;

function loadEncryptionKey() {
  const raw = process.env[KEY_ENV];
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`${KEY_ENV} is required and must be a 32-byte base64 key`);
  }
  let key;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`${KEY_ENV} is malformed; expected base64-encoded 32-byte key`);
  }
  if (key.length !== EXPECTED_KEY_BYTES) {
    throw new Error(`${KEY_ENV} is malformed; decoded length must be ${EXPECTED_KEY_BYTES} bytes`);
  }
  return key;
}

function activeKeyVersion() {
  const version = process.env[VERSION_ENV];
  if (!version || typeof version !== 'string' || version.trim() === '') {
    throw new Error(`${VERSION_ENV} is required`);
  }
  return version.trim();
}

/**
 * Encrypt a token string with AES-256-GCM.
 * @returns {{ ciphertext: string, iv: string, tag: string, keyVersion: string }} base64 fields
 */
function encryptToken(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken requires a non-empty plaintext string');
  }
  const key = loadEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyVersion: activeKeyVersion(),
  };
}

/**
 * Decrypt an AES-256-GCM envelope. Fails closed on tamper or wrong key.
 * @param {{ ciphertext: string, iv: string, tag: string, keyVersion?: string }} envelope
 */
function decryptToken(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('decryptToken requires an envelope object');
  }
  const { ciphertext, iv, tag, keyVersion } = envelope;
  if (!ciphertext || !iv || !tag) {
    throw new Error('decryptToken envelope is incomplete');
  }
  const expectedVersion = activeKeyVersion();
  if (keyVersion && keyVersion !== expectedVersion) {
    throw new Error(`Unknown or inactive token key version: ${keyVersion}`);
  }
  const key = loadEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

module.exports = {
  loadEncryptionKey,
  encryptToken,
  decryptToken,
  activeKeyVersion,
};
