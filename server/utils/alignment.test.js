const { expect } = require('chai');
const { mapVocabToLyrics } = require('./alignment');

describe('Alignment Utility', () => {
  const lyricsLines = [
    { text: 'Hello world', time: 0 },
    { text: 'HELLO WORLD', time: 5 },
    { text: 'This is a test of the alignment utility.', time: 10 }
  ];

  it('should find exact matches and fallbacks', () => {
    const vocabItems = [{ id: 'v1', word: 'Hello' }];
    const result = mapVocabToLyrics(vocabItems, lyricsLines);
    expect(result).to.have.lengthOf(2);
    expect(result[0]).to.deep.equal({ vocab_id: 'v1', line_index: 0, char_start: 0, char_end: 5 });
    expect(result[1]).to.deep.equal({ vocab_id: 'v1', line_index: 1, char_start: 0, char_end: 5 });
  });

  it('should find case-insensitive matches as fallback', () => {
    const vocabItems = [{ id: 'v2', word: 'hello' }];
    const result = mapVocabToLyrics(vocabItems, lyricsLines);
    expect(result).to.have.lengthOf(2);
    expect(result[0].line_index).to.equal(0);
    expect(result[1].line_index).to.equal(1);
  });

  it('should find multiple occurrences in the same line', () => {
    const vocabLines = [{ text: 'test test test', time: 0 }];
    const vocabItems = [{ id: 'v3', word: 'test' }];
    const result = mapVocabToLyrics(vocabItems, vocabLines);
    expect(result).to.have.lengthOf(3);
    expect(result[0].char_start).to.equal(0);
    expect(result[1].char_start).to.equal(5);
    expect(result[2].char_start).to.equal(10);
    for (const occ of result) {
      expect(occ.char_end - occ.char_start).to.equal(4);
    }
  });

  it('should handle missing text gracefully', () => {
    const brokenLines = [{ text: null }, { text: '' }];
    const vocabItems = [{ id: 'v4', word: 'test' }];
    const result = mapVocabToLyrics(vocabItems, brokenLines);
    expect(result).to.be.empty;
  });

  // ---- Regression tests for the "imán inside camino" bug ----

  it('REGRESSION: does not match a vocab word inside a longer word (no word boundaries)', () => {
    // "imán" appears INSIDE "camino" (c-a-m-i-n-o), but actually 'imán' is i-m-á-n
    // and 'camino' is c-a-m-i-n-o — 'imin' matches in camino. We use a clearly
    // substring-only case: 'min' inside 'caminar' would match without boundaries.
    const lines = [{ text: 'caminar por el camino' }];
    const result = mapVocabToLyrics([{ id: 'v5', word: 'min' }], lines);
    expect(result).to.have.lengthOf(0);
  });

  it('REGRESSION: matches on word boundary only', () => {
    const lines = [{ text: 'Quiero desnudarte a besos' }];
    const result = mapVocabToLyrics([{ id: 'v6', word: 'desnudarte' }], lines);
    expect(result).to.have.lengthOf(1);
    expect(result[0].char_start).to.equal(7);
    expect(result[0].char_end).to.equal(17);
  });

  it('REGRESSION: case+accent insensitive — matches "DESNUDARTE" to "desnudarte"', () => {
    const lines = [{ text: 'DESNUDARTE a besos despacito' }];
    const result = mapVocabToLyrics([{ id: 'v7', word: 'desnudarte' }], lines);
    expect(result).to.have.lengthOf(1);
    expect(result[0].char_start).to.equal(0);
    expect(result[0].char_end).to.equal(10);
  });

  it('REGRESSION: refuses to span from one word into the next', () => {
    // "al oido" must NOT match inside "calor oido" by lighting up "al o..." across words.
    const lines = [{ text: 'calor oido en la calle' }];
    const result = mapVocabToLyrics([{ id: 'v8', word: 'al oído' }], lines);
    expect(result).to.have.lengthOf(0);
  });

  it('REGRESSION: anchored match at start and end of line', () => {
    const lines = [
      { text: 'sobrepasar tus zonas de peligro' },
      { text: '   sobrepasar   ' }
    ];
    const result = mapVocabToLyrics([{ id: 'v9', word: 'sobrepasar' }], lines);
    expect(result).to.have.lengthOf(2);
    expect(result[0].char_start).to.equal(0);
    expect(result[0].char_end).to.equal(10);
    expect(result[1].char_start).to.equal(3);
    expect(result[1].char_end).to.equal(13);
  });
});
