const VALID_LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'pt'];

const LANG_CODE_TO_NAME = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
};

function languageNameFromCode(code, fallback = 'Spanish') {
  if (!code) return fallback;
  return LANG_CODE_TO_NAME[code] || fallback;
}

module.exports = {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  languageNameFromCode,
};
