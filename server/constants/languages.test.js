const { expect } = require('chai');
const {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  languageNameFromCode,
  wordMatchesTargetLanguage,
} = require('./languages');

describe('Language constants', () => {
  it('defines all six supported language codes', () => {
    expect(VALID_LANGUAGE_CODES).to.deep.equal(['en', 'es', 'fr', 'de', 'pt', 'it']);
  });

  it('maps every supported code to a display name', () => {
    for (const code of VALID_LANGUAGE_CODES) {
      expect(LANG_CODE_TO_NAME[code], code).to.be.a('string').and.not.empty;
    }
  });

  it('resolves known codes via languageNameFromCode', () => {
    expect(languageNameFromCode('pt')).to.equal('Portuguese');
    expect(languageNameFromCode('it')).to.equal('Italian');
    expect(languageNameFromCode('de')).to.equal('German');
    expect(languageNameFromCode('en')).to.equal('English');
    expect(languageNameFromCode('fr')).to.equal('French');
    expect(languageNameFromCode('es')).to.equal('Spanish');
  });

  it('falls back for unknown codes', () => {
    expect(languageNameFromCode('xx')).to.equal('Spanish');
    expect(languageNameFromCode(null, 'English')).to.equal('English');
  });

  it('rejects obvious English words when learning Spanish', () => {
    expect(wordMatchesTargetLanguage('screaming', 'es')).to.equal(false);
    expect(wordMatchesTargetLanguage('searching', 'es')).to.equal(false);
    expect(wordMatchesTargetLanguage('contratos', 'es')).to.equal(true);
    expect(wordMatchesTargetLanguage('tranquila', 'es')).to.equal(true);
    expect(wordMatchesTargetLanguage('corazón', 'es')).to.equal(true);
  });

  it('accepts Italian words with accented characters', () => {
    expect(wordMatchesTargetLanguage('città', 'it')).to.equal(true);
    expect(wordMatchesTargetLanguage('perché', 'it')).to.equal(true);
    expect(wordMatchesTargetLanguage('screaming', 'it')).to.equal(false);
  });

  it('accepts English words only for English learners', () => {
    expect(wordMatchesTargetLanguage('screaming', 'en')).to.equal(true);
    expect(wordMatchesTargetLanguage('corazón', 'en')).to.equal(false);
  });
});
