const { expect } = require('chai');
const {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  languageNameFromCode,
} = require('./languages');

describe('Language constants', () => {
  it('defines all five supported language codes', () => {
    expect(VALID_LANGUAGE_CODES).to.deep.equal(['en', 'es', 'fr', 'de', 'pt']);
  });

  it('maps every supported code to a display name', () => {
    for (const code of VALID_LANGUAGE_CODES) {
      expect(LANG_CODE_TO_NAME[code], code).to.be.a('string').and.not.empty;
    }
  });

  it('resolves known codes via languageNameFromCode', () => {
    expect(languageNameFromCode('pt')).to.equal('Portuguese');
    expect(languageNameFromCode('de')).to.equal('German');
    expect(languageNameFromCode('en')).to.equal('English');
    expect(languageNameFromCode('fr')).to.equal('French');
    expect(languageNameFromCode('es')).to.equal('Spanish');
  });

  it('falls back for unknown codes', () => {
    expect(languageNameFromCode('xx')).to.equal('Spanish');
    expect(languageNameFromCode(null, 'English')).to.equal('English');
  });
});
