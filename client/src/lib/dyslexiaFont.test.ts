import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dyslexiaFontOn } from './dyslexiaFont.ts';

describe('dyslexiaFontOn', () => {
  it('turns the font on only for an explicit true flag', () => {
    assert.equal(dyslexiaFontOn(1), true);
    assert.equal(dyslexiaFontOn(true), true);
    assert.equal(dyslexiaFontOn('1'), true);
  });

  it('keeps the font off for zero, false, and empty values', () => {
    assert.equal(dyslexiaFontOn(0), false);
    assert.equal(dyslexiaFontOn(false), false);
    assert.equal(dyslexiaFontOn('0'), false);
    assert.equal(dyslexiaFontOn('false'), false);
    assert.equal(dyslexiaFontOn(null), false);
    assert.equal(dyslexiaFontOn(undefined), false);
  });
});
