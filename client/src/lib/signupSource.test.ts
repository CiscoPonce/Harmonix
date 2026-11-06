import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeSignupSource } from './signupSource.ts';

describe('normalizeSignupSource', () => {
  it('keeps a short source and lowercases it', () => {
    assert.equal(normalizeSignupSource('postcard'), 'postcard');
    assert.equal(normalizeSignupSource('Postcard'), 'postcard');
  });

  it('rejects spaces, empty values, long values, and markup', () => {
    assert.equal(normalizeSignupSource('a b'), null);
    assert.equal(normalizeSignupSource(''), null);
    assert.equal(normalizeSignupSource('a'.repeat(41)), null);
    assert.equal(normalizeSignupSource('<x>'), null);
  });
});
