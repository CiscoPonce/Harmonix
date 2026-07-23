const { expect } = require('chai');
const {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  languageNameFromCode,
  wordMatchesTargetLanguage,
  getLyricStopwords,
  LYRIC_STOPWORDS_BY_LANG,
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

  it('defines lyric stopwords for every supported language', () => {
    for (const code of VALID_LANGUAGE_CODES) {
      const stops = getLyricStopwords(code);
      expect(stops, code).to.be.instanceOf(Set);
      expect(stops.size, code).to.be.at.least(10);
      expect(LYRIC_STOPWORDS_BY_LANG[code], code).to.equal(stops);
    }
  });

  it('filters bilingual English slips for French and German', () => {
    expect(wordMatchesTargetLanguage('tonight', 'fr')).to.equal(false);
    expect(wordMatchesTargetLanguage('baby', 'de')).to.equal(false);
    expect(wordMatchesTargetLanguage('change', 'de')).to.equal(false);
    expect(wordMatchesTargetLanguage('freedom', 'de')).to.equal(false);
    expect(wordMatchesTargetLanguage('listening', 'de')).to.equal(false);
    expect(wordMatchesTargetLanguage('chanson', 'fr')).to.equal(true);
    expect(wordMatchesTargetLanguage('Männer', 'de')).to.equal(true);
    expect(wordMatchesTargetLanguage('Atemlos', 'de')).to.equal(true);
    expect(wordMatchesTargetLanguage('Liebe', 'de')).to.equal(true);
    // German will/was must remain valid vocabulary
    expect(wordMatchesTargetLanguage('will', 'de')).to.equal(true);
    expect(wordMatchesTargetLanguage('was', 'de')).to.equal(true);
  });

  it('rejects Spanish orthography and false friends when learning Portuguese', () => {
    expect(wordMatchesTargetLanguage('misión', 'pt')).to.equal(false);
    expect(wordMatchesTargetLanguage('estás', 'pt')).to.equal(false);
    expect(wordMatchesTargetLanguage('cómo', 'pt')).to.equal(false);
    expect(wordMatchesTargetLanguage('corazón', 'pt')).to.equal(false);
    expect(wordMatchesTargetLanguage('noche', 'pt')).to.equal(false);
    expect(wordMatchesTargetLanguage('también', 'pt')).to.equal(false);
    expect(wordMatchesTargetLanguage('explosão', 'pt')).to.equal(true);
    expect(wordMatchesTargetLanguage('você', 'pt')).to.equal(true);
    expect(wordMatchesTargetLanguage('também', 'pt')).to.equal(true);
    expect(wordMatchesTargetLanguage('coração', 'pt')).to.equal(true);
    expect(wordMatchesTargetLanguage('garota', 'pt')).to.equal(true);
  });

  it('rejects Portuguese markers when learning Spanish', () => {
    expect(wordMatchesTargetLanguage('explosão', 'es')).to.equal(false);
    expect(wordMatchesTargetLanguage('coração', 'es')).to.equal(false);
    expect(wordMatchesTargetLanguage('corazón', 'es')).to.equal(true);
  });

  it('sniffs Spanish lyrics as incompatible with Portuguese target', () => {
    const { lyricsMatchTargetLanguage } = require('./languages');
    const spanish = 'cómo estás mi corazón también qué señor gracias hola';
    const portuguese = 'você não tem razão coração também explosão saudade';
    expect(lyricsMatchTargetLanguage(spanish, 'pt')).to.equal(false);
    expect(lyricsMatchTargetLanguage(portuguese, 'pt')).to.equal(true);
  });

  it('accepts Spanish / light-Spanglish lyrics and rejects English-dominant tracks', () => {
    const { lyricsMatchTargetLanguage } = require('./languages');
    const echame =
      'Tengo en esta historia algo que confesar Ya entendí muy bien qué fue lo que pasó ' +
      'Y aunque duela tanto tengo que aceptar Que te quiero y voy a bailar siempre contigo';
    const senorita =
      'I love it when you call me senorita I wish I could pretend I didn\'t need ya ' +
      'But every touch is true I should be running you keep me coming for you ' +
      'I love it when you call me senorita I wish I could pretend I didn\'t need ya';
    const propuesta =
      'Hola me llaman Romeo Es un placer conocerla Qué bien te ves ' +
      'Te adelanto no me importa quién sea él Dígame usted si ha hecho algo travieso';
    expect(lyricsMatchTargetLanguage(echame, 'es')).to.equal(true);
    expect(lyricsMatchTargetLanguage(propuesta, 'es')).to.equal(true);
    expect(lyricsMatchTargetLanguage(senorita, 'es')).to.equal(false);
  });

  it('sniffs English lyrics as incompatible with German target', () => {
    const { lyricsMatchTargetLanguage } = require('./languages');
    const windOfChange =
      'I follow the Moskva Down to Gorky Park Listening to the wind of change ' +
      'The world is closing in Did you ever think That we could be so close, like brothers ' +
      'The future\'s in the air I can feel it everywhere Blowing with the wind of change';
    const atemlos =
      'Atemlos durch die Nacht Ich kann dich nicht verlieren ' +
      'Wir sind unzertrennlich und für immer und ewig ' +
      'Ich will dich nicht verlieren was ist das für eine Liebe';
    expect(lyricsMatchTargetLanguage(windOfChange, 'de')).to.equal(false);
    expect(lyricsMatchTargetLanguage(atemlos, 'de')).to.equal(true);
  });

  it('sniffs English Beggin lyrics as incompatible with Italian', () => {
    const { lyricsMatchTargetLanguage } = require('./languages');
    const beggin =
      'Put your hands up in the air Put your hands up in the air ' +
      'I\'m beggin beggin you So put your loving hand out baby ' +
      'I\'m beggin beggin you So put your loving hand out darling';
    const italian = 'Più bella cosa non c\'è Di te amore mio quando stai con me sempre';
    expect(lyricsMatchTargetLanguage(beggin, 'it')).to.equal(false);
    expect(lyricsMatchTargetLanguage(italian, 'it')).to.equal(true);
  });
});
