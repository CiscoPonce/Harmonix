const VALID_LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'pt', 'it'];

const LANG_CODE_TO_NAME = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
};

/** English words common in bilingual pop/reggaeton lyrics — not valid learning targets for other languages. */
const ENGLISH_IN_LYRICS = new Set([
  'screaming', 'searching', 'love', 'baby', 'yeah', 'oh', 'hey', 'tonight',
  'feel', 'feeling', 'feelings', 'crazy', 'girl', 'boy', 'money', 'party', 'ready',
  'work', 'body', 'dance', 'dancing', 'hot', 'cool', 'super', 'like', 'you',
  'me', 'my', 'the', 'and', 'all', 'right', 'yeah', 'yes', 'no', 'good', 'bad',
  'back', 'come', 'go', 'going', 'want', 'need', 'make', 'made', 'take', 'give',
  'world', 'life', 'heart', 'eyes', 'hands', 'mind', 'time', 'day', 'night',
  'forever', 'always', 'never', 'everything', 'something', 'nothing', 'everybody',
  'somebody', 'watching', 'waiting', 'running', 'walking', 'talking', 'thinking',
  'dreaming', 'believing', 'living', 'loving', 'hating', 'crying', 'smiling',
  'beautiful', 'perfect', 'crazy', 'loco', 'fire', 'light', 'dark', 'free',
]);

/**
 * Spanish orthography / high-frequency tokens that must not be accepted as Portuguese.
 * Portuguese counterparts differ (missão, coração, também, você, não, …).
 */
const SPANISH_FALSE_FRIENDS_FOR_PT = new Set([
  'misión', 'corazón', 'noche', 'hola', 'gracias', 'pedí', 'allá', 'aquí', 'cómo',
  'quién', 'qué', 'dónde', 'cuándo', 'también', 'españa', 'español', 'señor', 'señora',
  'mañana', 'niño', 'niña', 'año', 'años', 'muñeca', 'sueño', 'dueño', 'baño',
  'estás', 'está', 'están', 'estáis', 'eres', 'sois',
  'porque', 'porqué', 'además', 'después',
  'corazon', 'mission', 'tambien', 'espanol', 'senor',
  'misión', 'cancion', 'canción', 'corazón',
]);

const LYRIC_STOPWORDS_BY_LANG = {
  es: new Set([
    'que', 'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'por', 'con',
    'no', 'es', 'se', 'te', 'lo', 'le', 'da', 'su', 'yo', 'tu', 'mi', 'ya', 'si',
    'bien', 'muy', 'mas', 'más', 'del', 'al', 'les', 'nos', 'me', 'fue', 'ser',
  ]),
  en: new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'not', 'no', 'yes',
  ]),
  fr: new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'en', 'à', 'a', 'au', 'aux',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'mon',
    'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses', 'ne', 'pas', 'que', 'qui', 'est',
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'oder', 'aber', 'in', 'im', 'an', 'am', 'auf', 'zu', 'zum', 'zur', 'mit',
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein', 'sein', 'nicht', 'ist',
  ]),
  pt: new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
    'e', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'que', 'não', 'nao',
    'eu', 'tu', 'ele', 'ela', 'nós', 'nos', 'vocês', 'eles', 'elas', 'me', 'te', 'se',
    'meu', 'minha', 'seu', 'sua', 'é', 'ser',
  ]),
  it: new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'dei',
    'e', 'ed', 'in', 'a', 'da', 'per', 'con', 'su', 'che', 'non', 'mi', 'ti', 'si',
    'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'mio', 'mia', 'tuo', 'tua', 'è', 'sono',
  ]),
};

function languageNameFromCode(code, fallback = 'Spanish') {
  if (!code) return fallback;
  return LANG_CODE_TO_NAME[code] || fallback;
}

function normalizeLangCode(code) {
  return String(code || 'es').toLowerCase();
}

function getLyricStopwords(langCode) {
  const code = normalizeLangCode(langCode);
  return LYRIC_STOPWORDS_BY_LANG[code] || LYRIC_STOPWORDS_BY_LANG.es;
}

/**
 * Heuristic check: does a lyric token look like vocabulary in the user's target language?
 * Used to skip English sections in bilingual songs when learning Spanish/French/etc.
 */
function wordMatchesTargetLanguage(word, langCode) {
  const w = String(word || '').trim();
  if (!w || !/[\p{L}]/u.test(w)) return false;

  const lower = w.toLowerCase();
  const code = normalizeLangCode(langCode);

  if (code === 'en') {
    if (/[ñ¿¡]/i.test(w)) return false;
    if (/[áéíóú]/i.test(w) && !/[àâäçèéêëîïôùûü]/i.test(w)) return false;
    return /^[\p{L}'-]+$/u.test(w);
  }

  if (ENGLISH_IN_LYRICS.has(lower)) return false;

  if (code === 'es') {
    // Reject strong Portuguese markers so PT songs are not accepted for Spanish learners.
    if (/[ãõ]/i.test(w) || /ção$|ções$|ões$/i.test(w)) return false;
    if (/[ñáéíóúü]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment|ful|less|able|ible|ous|ive|ized|izing)$/i.test(w)) return false;
    return /^[\p{L}áéíóúñüÁÉÍÓÚÑÜ'-]+$/u.test(w);
  }

  if (code === 'pt') {
    // Spanish-only orthography
    if (/[ñ¿¡]/i.test(w)) return false;
    if (/ción$/i.test(w)) return false; // PT uses -ção
    if (SPANISH_FALSE_FRIENDS_FOR_PT.has(lower)) return false;
    // Strong Portuguese markers — accept
    if (/[ãõç]/i.test(w)) return true;
    if (/(ção|ções|ões)$/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment)$/i.test(w)) return false;
    return /^[\p{L}ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ'-]+$/u.test(w);
  }

  if (code === 'fr') {
    if (/[àâäçéèêëîïôùûüÿœæ]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w) && !/[àâçéèêëîïôùûü]/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment)$/i.test(w) && !/[àâçéèêëîïôùûü]/i.test(w)) return false;
    return /^[\p{L}àâäçéèêëîïôùûüÿœæ'-]+$/u.test(w);
  }

  if (code === 'de') {
    if (/[äöüß]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment)$/i.test(w)) return false;
    return /^[\p{L}äöüßÄÖÜ'-]+$/u.test(w);
  }

  if (code === 'it') {
    if (/[àèéìòù]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment)$/i.test(w)) return false;
    return /^[\p{L}àèéìòùÀÈÉÌÒÙ'-]+$/u.test(w);
  }

  return true;
}

/**
 * Cheap lyric-language sniff to reject Spanish (or other) tracks when learning Portuguese.
 * Returns true when lyrics look compatible with the target language.
 */
function lyricsMatchTargetLanguage(plainLyrics, langCode) {
  const plain = String(plainLyrics || '');
  if (!plain.trim()) return false;
  const code = normalizeLangCode(langCode);

  if (code === 'pt') {
    const ptHits = (plain.match(/[ãõç]|ção|ções|ões|\bnão\b|\bvocê\b|\btambém\b|\bpra\b|\bvocês\b|\bestão\b/gi) || []).length;
    // Use Spanish-distinctive markers only — avoid "está" (also Portuguese).
    const esHits = (plain.match(/[ñ]|ción|\btambién\b|\bcorazón\b|\bcómo\b|\bqué\b|\bquién\b|\bestás\b|\bespañol\b|\bseñor\b|\bhola\b|\bgracias\b|\bmisión\b/gi) || []).length;
    if (esHits >= 3 && esHits > ptHits) return false;
    if (ptHits === 0 && esHits >= 2) return false;
    return true;
  }

  if (code === 'es') {
    const esHits = (plain.match(/[ñ]|ción|\btambién\b|\bcorazón\b|\bcómo\b|\bqué\b/gi) || []).length;
    const ptHits = (plain.match(/[ãõ]|ção|ções|\bnão\b|\bvocê\b|\btambém\b/gi) || []).length;
    if (ptHits >= 3 && ptHits > esHits) return false;
    return true;
  }

  return true;
}

module.exports = {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  ENGLISH_IN_LYRICS,
  SPANISH_FALSE_FRIENDS_FOR_PT,
  LYRIC_STOPWORDS_BY_LANG,
  languageNameFromCode,
  normalizeLangCode,
  getLyricStopwords,
  wordMatchesTargetLanguage,
  lyricsMatchTargetLanguage,
};
