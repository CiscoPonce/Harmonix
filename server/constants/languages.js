const VALID_LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'pt'];

const LANG_CODE_TO_NAME = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
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

function languageNameFromCode(code, fallback = 'Spanish') {
  if (!code) return fallback;
  return LANG_CODE_TO_NAME[code] || fallback;
}

function normalizeLangCode(code) {
  return String(code || 'es').toLowerCase();
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
    if (/[ñáéíóúü]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment|ful|less|able|ible|ous|ive|ized|izing)$/i.test(w)) return false;
    return /^[\p{L}áéíóúñüÁÉÍÓÚÑÜ'-]+$/u.test(w);
  }

  if (code === 'pt') {
    if (/[ãõçáéíóúâêô]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    return /^[\p{L}ãõçáéíóúâêôÃÕÇÁÉÍÓÚÂÊÔ'-]+$/u.test(w);
  }

  if (code === 'fr') {
    if (/[àâäçéèêëîïôùûüÿœæ]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w) && !/[àâçéèêëîïôùûü]/i.test(w)) return false;
    return /^[\p{L}àâäçéèêëîïôùûüÿœæ'-]+$/u.test(w);
  }

  if (code === 'de') {
    if (/[äöüß]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    return /^[\p{L}äöüßÄÖÜ'-]+$/u.test(w);
  }

  return true;
}

module.exports = {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  ENGLISH_IN_LYRICS,
  languageNameFromCode,
  normalizeLangCode,
  wordMatchesTargetLanguage,
};
