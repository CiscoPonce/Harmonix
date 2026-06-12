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
    // Line 0 is exact, Line 1 is case-insensitive fallback
    expect(result).to.have.lengthOf(2);
    expect(result[0]).to.deep.equal({ vocab_id: 'v1', line_index: 0, char_start: 0 });
    expect(result[1]).to.deep.equal({ vocab_id: 'v1', line_index: 1, char_start: 0 });
  });

  it('should find case-insensitive matches as fallback', () => {
    const vocabItems = [{ id: 'v2', word: 'hello' }];
    const result = mapVocabToLyrics(vocabItems, lyricsLines);
    // Line 0 and Line 1 are case-insensitive matches
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
  });

  it('should handle missing text gracefully', () => {
    const brokenLines = [{ text: null }, { text: '' }];
    const vocabItems = [{ id: 'v4', word: 'test' }];
    const result = mapVocabToLyrics(vocabItems, brokenLines);
    expect(result).to.be.empty;
  });
});
