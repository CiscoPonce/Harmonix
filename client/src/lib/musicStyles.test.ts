import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { visibleMusicStyles } from './musicStyles.ts';

const ALL = [
  { value: 'any', label: 'Any' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'reggaeton', label: 'Reggaeton' },
];

describe('visibleMusicStyles', () => {
  it('hides reggaeton for English when the catalog omits it', () => {
    const shown = visibleMusicStyles(ALL, ['any', 'pop', 'rock', 'hip-hop'], 'pop');
    assert.equal(shown.some((s) => s.value === 'reggaeton'), false);
    assert.equal(shown.some((s) => s.value === 'pop'), true);
  });

  it('keeps reggaeton when Spanish catalogs include it', () => {
    const shown = visibleMusicStyles(ALL, ['any', 'pop', 'rock', 'hip-hop', 'reggaeton'], 'pop');
    assert.equal(shown.some((s) => s.value === 'reggaeton'), true);
  });
});
