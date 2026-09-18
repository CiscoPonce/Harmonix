import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { uniqueShelfWords } from './shelf.ts';

describe('uniqueShelfWords', () => {
  it('keeps one card when the same word was saved twice', () => {
    const rows = uniqueShelfWords([
      { word: { text: 'flame' }, song: { id: 'maps' } },
      { word: { text: 'Flame' }, song: { id: 'maps' } },
      { word: { text: 'trust' }, song: { id: 'bl' } },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].word?.text, 'flame');
    assert.equal(rows[1].word?.text, 'trust');
  });

  it('skips empty word text', () => {
    const rows = uniqueShelfWords([
      { word: { text: '  ' } },
      { word: { text: 'true' } },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].word?.text, 'true');
  });
});
