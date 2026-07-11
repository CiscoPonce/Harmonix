const VALID_LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'pt', 'it'];

const LANG_CODE_TO_NAME = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
};

/** English words common in bilingual / Anglophone lyrics — not valid learning targets for other languages. */
const ENGLISH_IN_LYRICS = new Set([
  'screaming', 'searching', 'love', 'baby', 'yeah', 'oh', 'hey', 'tonight',
  'feel', 'feeling', 'feelings', 'crazy', 'girl', 'boy', 'money', 'party', 'ready',
  'work', 'body', 'dance', 'dancing', 'hot', 'cool', 'super', 'like', 'you',
  'me', 'my', 'the', 'and', 'all', 'right', 'yes', 'no', 'good', 'bad',
  'back', 'come', 'go', 'going', 'want', 'need', 'make', 'made', 'take', 'give',
  'world', 'life', 'heart', 'eyes', 'hands', 'mind', 'time', 'day', 'night',
  'forever', 'always', 'never', 'everything', 'something', 'nothing', 'everybody',
  'somebody', 'watching', 'waiting', 'running', 'walking', 'talking', 'thinking',
  'dreaming', 'believing', 'living', 'loving', 'hating', 'crying', 'smiling',
  'beautiful', 'perfect', 'loco', 'fire', 'light', 'dark', 'free',
  // High-frequency English from rock/pop (e.g. Wind of Change, Beggin')
  'change', 'wind', 'freedom', 'children', 'listening', 'follow', 'followed',
  'moskva', 'gorky', 'park', 'future', 'future\'s', 'closed', 'windows',
  'people', 'dream', 'dreams', 'believe', 'goodbye', 'hello', 'home', 'alone',
  'again', 'together', 'better', 'worse', 'friend', 'friends', 'kiss', 'hold',
  'held', 'keep', 'leave', 'left', 'stay', 'staying', 'please', 'sorry',
  'thank', 'thanks', 'because', 'before', 'after', 'about', 'around', 'through',
  'without', 'within', 'between', 'under', 'over', 'into', 'from', 'with',
  // Avoid German collisions: was (what), will (want), am, in, so, da, es
  'this', 'that', 'these', 'those', 'what', 'when', 'where', 'why', 'how',
  'who', 'which', 'would', 'could', 'should', 'have', 'has', 'had',
  'been', 'being', 'are', 'were', 'is', 'do', 'does', 'did',
  'don\'t', 'doesn\'t', 'didn\'t', 'can\'t', 'won\'t', 'isn\'t', 'aren\'t',
  'i\'m', 'you\'re', 'we\'re', 'they\'re', 'it\'s', 'that\'s',
  'your', 'our', 'their', 'his', 'her', 'its', 'them', 'they', 'we', 'he', 'she',
  'him', 'himself', 'herself', 'myself', 'yourself', 'ourselves',
  'know', 'knew', 'known', 'see', 'saw', 'seen', 'look', 'looking', 'hear',
  'heard', 'say', 'said', 'tell', 'told', 'think', 'thought', 'find', 'found',
  'let', 'lets', 'get', 'got', 'put', 'set', 'run', 'walk', 'talk', 'call',
  'called', 'try', 'tried', 'trying', 'stop', 'start', 'started', 'open',
  'opened', 'close', 'closed', 'turn', 'turned', 'bring', 'brought', 'break',
  'broken', 'fall', 'fell', 'fallen', 'rise', 'rose', 'stand', 'stood',
  'rain', 'sun', 'moon', 'star', 'stars', 'sky', 'skies', 'sea', 'river',
  'road', 'way', 'ways', 'place', 'places', 'city', 'town', 'country',
  'power', 'magic', 'passion', 'soul', 'blood', 'bone', 'bones', 'skin',
  'sweet', 'hard', 'soft', 'real', 'true', 'false', 'wrong', 'strong', 'weak',
  'young', 'old', 'new', 'long', 'short', 'high', 'low', 'big', 'small',
  'little', 'every', 'another', 'other', 'same', 'only', 'just', 'even',
  'still', 'also', 'too', 'very', 'more', 'most', 'much', 'many', 'some',
  'any', 'each', 'both', 'few', 'own', 'such', 'than', 'then', 'now', 'here',
  'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere',
  'today', 'tomorrow', 'yesterday', 'morning', 'evening', 'midnight',
  'remember', 'forget', 'forgot', 'forgotten', 'promise', 'promised',
  'wish', 'wishes', 'hope', 'hopes', 'hoped', 'hoping', 'afraid', 'scared',
  'happy', 'sad', 'lonely', 'angry', 'angel', 'angels', 'devil', 'heaven',
  'hell', 'god', 'lord', 'jesus', 'christ', 'amen', 'hallelujah',
  'beggin', 'begging', 'beggin\'', 'coming', 'leaving', 'losing', 'winning',
  'fighting', 'holding', 'falling', 'rising', 'burning', 'shining',
  'wondering', 'wandering', 'whispering',
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
    // Strong German morphology — accept even without umlauts
    if (/(ung|heit|keit|lich|schaft|chen|lein)$/i.test(w)) return true;
    if (/^ge[\p{L}]{3,}/iu.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment|ful|less|able|ible|ous|ive|ized|izing|edly|ally)$/i.test(w)) return false;
    // English past tense / plural-ish -ed without German markers
    if (/^[a-z]{4,}ed$/i.test(w)) return false;
    return /^[\p{L}äöüßÄÖÜ'-]+$/u.test(w);
  }

  if (code === 'it') {
    if (/[àèéìòù]/i.test(w)) return true;
    if (/^[a-z]+ing$/i.test(w)) return false;
    if (/^[a-z]+(tion|ness|ment|ful|less|able|ible)$/i.test(w)) return false;
    return /^[\p{L}àèéìòùÀÈÉÌÒÙ'-]+$/u.test(w);
  }

  return true;
}

/** Count strong English closed-class / content tokens in lyric text.
 * Avoid German collisions (was/will/in/am) — those are valid German tokens.
 */
function countEnglishLyricMarkers(plain) {
  return (plain.match(
    /\b(the|and|you|your|love|baby|tonight|feel|feeling|change|freedom|children|with|from|this|that|what|when|where|how|why|would|could|should|have|has|been|being|are|were|don'?t|can'?t|won'?t|i'?m|you'?re|we'?re|they'?re|listening|follow|followed|people|dream|dreams|believe|goodbye|hello|home|alone|again|together|better|never|always|forever|everything|something|nothing|everybody|watching|waiting|running|walking|talking|thinking|dreaming|beautiful|perfect|coming|leaving|beggin'?|begging|windows|future|closed|gorky|moskva)\b/gi
  ) || []).length;
}

/**
 * Cheap lyric-language sniff to reject wrong-language tracks (EN in DE, ES in PT, etc.).
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
    const enHits = countEnglishLyricMarkers(plain);
    if (enHits >= 8 && enHits > ptHits * 2) return false;
    return true;
  }

  if (code === 'es') {
    const esHits = (plain.match(/[ñ]|ción|\btambién\b|\bcorazón\b|\bcómo\b|\bqué\b/gi) || []).length;
    const ptHits = (plain.match(/[ãõ]|ção|ções|\bnão\b|\bvocê\b|\btambém\b/gi) || []).length;
    if (ptHits >= 3 && ptHits > esHits) return false;
    const enHits = countEnglishLyricMarkers(plain);
    if (enHits >= 8 && enHits > esHits * 2) return false;
    return true;
  }

  if (code === 'de') {
    const deHits = (plain.match(
      /[äöüß]|(\b(und|nicht|ich|du|wir|ihr|sie|der|die|das|ein|eine|einem|einen|einer|mit|auf|für|auch|noch|schon|wenn|denn|aber|oder|mein|dein|sein|keine|keinen|immer|wieder|liebe|nacht|herz|durch|ohne|über|unter|gegen|zwischen|Männer|Atemlos|Luftballons)\b)/gi
    ) || []).length;
    const enHits = countEnglishLyricMarkers(plain);
    if (enHits >= 6 && enHits > deHits) return false;
    if (deHits === 0 && enHits >= 4) return false;
    return true;
  }

  if (code === 'fr') {
    const frHits = (plain.match(
      /[àâäçéèêëîïôùûüÿœæ]|(\b(je|tu|il|elle|nous|vous|les|des|une|aux|est|pas|que|qui|dans|pour|avec|sur|mais|plus|tout|tous|cette|cette|mon|ton|son|mais|très|aussi)\b)/gi
    ) || []).length;
    const enHits = countEnglishLyricMarkers(plain);
    if (enHits >= 6 && enHits > frHits) return false;
    if (frHits === 0 && enHits >= 4) return false;
    return true;
  }

  if (code === 'it') {
    const itHits = (plain.match(
      /[àèéìòù]|(\b(che|non|sono|della|delle|degli|con|per|una|uno|mio|mia|tuo|tua|anche|quando|dove|come|più|sempre|amore|cuore|vita|notte)\b)/gi
    ) || []).length;
    const enHits = countEnglishLyricMarkers(plain);
    if (enHits >= 6 && enHits > itHits) return false;
    if (itHits === 0 && enHits >= 4) return false;
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
