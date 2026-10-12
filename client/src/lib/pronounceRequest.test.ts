import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pronunciationClipKey, pronouncePath } from './pronounceRequest.ts';

describe('pronounce request cache key', () => {
  it('keys the clip by gender so a settings change does not replay the other voice', () => {
    const word = 'harbor';
    assert.notEqual(
      pronunciationClipKey(word, 'female'),
      pronunciationClipKey(word, 'male'),
    );
    assert.equal(pronunciationClipKey(word, 'female'), 'female::harbor');
    assert.equal(pronunciationClipKey(`  ${word}  `, 'nope'), 'female::harbor');
  });

  it('puts voice on the pronounce URL', () => {
    const path = pronouncePath('harbor', 'en', 'male');
    const url = new URL(path, 'https://harmonix.example');
    assert.equal(url.searchParams.get('word'), 'harbor');
    assert.equal(url.searchParams.get('lang'), 'en');
    assert.equal(url.searchParams.get('voice'), 'male');
  });
});
