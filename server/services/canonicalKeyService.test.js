const { expect } = require('chai');
const { foldWord } = require('./canonicalKeyService');

describe('Canonical Key Service', () => {
  describe('foldWord()', () => {
    it('lowercases ASCII', () => {
      expect(foldWord('CORAZON')).to.equal('corazon');
      expect(foldWord('Despacito')).to.equal('despacito');
    });

    it('strips Spanish diacritics by NFD + combining-mark removal', () => {
      expect(foldWord('corazón')).to.equal('corazon');
      expect(foldWord('Corazón')).to.equal('corazon');
      expect(foldWord('despacito')).to.equal('despacito');
      expect(foldWord('después')).to.equal('despues');
      expect(foldWord('NIÑA')).to.equal('nina');
    });

    it('treats composed and decomposed forms as the same word', () => {
      // ó (U+00F3, composed) vs o+combining acute (U+006F U+0301, decomposed)
      const composed = 'coraz\u00f3n';
      const decomposed = 'coraz\u006f\u0301n';
      expect(composed).to.not.equal(decomposed); // sanity: different bytes
      expect(foldWord(composed)).to.equal(foldWord(decomposed));
    });

    it('handles empty / whitespace-only / null safely', () => {
      expect(foldWord('')).to.equal('');
      expect(foldWord('   ')).to.equal('');
      expect(foldWord(null)).to.equal('');
      expect(foldWord(undefined)).to.equal('');
    });

    it('is stable across call ordering', () => {
      const words = ['Corazón', 'corazón', 'CORAZON', 'después', 'despues', '', 'NIÑA'];
      const keys = words.map(foldWord).sort();
      expect(keys).to.deep.equal(['', 'corazon', 'corazon', 'corazon', 'despues', 'despues', 'nina']);
    });
  });

  describe('buildCanonicalKey() (canonical_key column format)', () => {
    // The convention used by vocab.js: `${foldWord(word)}|${language}`
    const buildCanonicalKey = (word, lang) => `${foldWord(word)}|${lang || ''}`;

    it('produces identical keys for case/accent variants', () => {
      expect(buildCanonicalKey('Corazón', 'es')).to.equal(buildCanonicalKey('CORAZON', 'es'));
      expect(buildCanonicalKey('después', 'es')).to.equal(buildCanonicalKey('despues', 'es'));
    });

    it('distinguishes languages', () => {
      expect(buildCanonicalKey('corazon', 'es')).to.not.equal(buildCanonicalKey('corazon', 'fr'));
    });
  });
});
