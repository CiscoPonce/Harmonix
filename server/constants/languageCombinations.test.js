const { expect } = require('chai');
const { VALID_LANGUAGE_CODES, LANG_CODE_TO_NAME } = require('../constants/languages');
const {
  getVerifiedSongCandidates,
  getCuratedSongCandidates,
} = require('../services/aiService');

describe('Language combinations', () => {
  for (const code of VALID_LANGUAGE_CODES) {
    it(`target ${code} has a language-specific verified catalog (not Spanish-only fallback)`, () => {
      const songs = getVerifiedSongCandidates(code, 'pop');
      expect(songs.length, code).to.be.at.least(5);
      if (code !== 'es') {
        const spanishOnly = songs.every((s) =>
          /iglesias|fonsi|bad bunny|maluma|marc anthony/i.test(`${s.artist} ${s.song_title}`)
        );
        expect(spanishOnly, `${code} should not be Spanish-only`).to.equal(false);
      }
    });

    it(`target ${code} has curated examples`, () => {
      const curated = getCuratedSongCandidates(code, 'pop');
      expect(curated.length, code).to.be.at.least(3);
    });
  }

  it('defines 30 valid native→target preference pairs', () => {
    const pairs = [];
    for (const native of VALID_LANGUAGE_CODES) {
      for (const target of VALID_LANGUAGE_CODES) {
        if (native !== target) pairs.push(`${native}→${target}`);
      }
    }
    expect(pairs).to.have.lengthOf(30);
    expect(pairs).to.include('en→it');
    expect(pairs).to.include('it→es');
  });

  for (const code of VALID_LANGUAGE_CODES) {
    it(`maps ${code} to ${LANG_CODE_TO_NAME[code]}`, () => {
      expect(LANG_CODE_TO_NAME[code]).to.be.a('string').and.not.empty;
    });
  }
});
