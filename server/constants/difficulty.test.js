const { expect } = require('chai');
const {
  effectiveCefr,
  difficultyMatchScore,
  filterVocabularyByLevel,
  cefrWithinBand,
} = require('./difficulty');

describe('difficulty helpers', () => {
  it('caps easy learners at A2 even with default B1 CEFR', () => {
    expect(effectiveCefr('B1', 'easy')).to.equal('A2');
    expect(effectiveCefr('C1', 'easy')).to.equal('A2');
  });

  it('floors hard learners at B2', () => {
    expect(effectiveCefr('B1', 'hard')).to.equal('B2');
    expect(effectiveCefr('A1', 'hard')).to.equal('B2');
  });

  it('keeps medium at stored CEFR', () => {
    expect(effectiveCefr('B1', 'medium')).to.equal('B1');
    expect(effectiveCefr('C1', 'medium')).to.equal('C1');
  });

  it('scores difficulty matches for candidate ranking', () => {
    expect(difficultyMatchScore('easy', 'easy')).to.equal(3);
    expect(difficultyMatchScore('medium', 'easy')).to.equal(1);
    expect(difficultyMatchScore('hard', 'easy')).to.equal(0);
  });

  it('filters vocabulary that is too advanced for easy mode', () => {
    const vocab = [
      { word: 'casa', cefr_level: 'A1' },
      { word: 'amor', cefr_level: 'A2' },
      { word: 'melancolía', cefr_level: 'C1' },
      { word: 'idiosincrasia', cefr_level: 'C2' },
    ];
    const filtered = filterVocabularyByLevel(vocab, 'A2', 'easy');
    expect(filtered.map((v) => v.word)).to.include.members(['casa', 'amor']);
    expect(filtered.map((v) => v.word)).to.not.include('idiosincrasia');
  });

  it('accepts B2+ words for hard mode', () => {
    expect(cefrWithinBand('C1', 'B2', 'hard')).to.equal(true);
    expect(cefrWithinBand('A1', 'B2', 'hard')).to.equal(false);
  });
});
