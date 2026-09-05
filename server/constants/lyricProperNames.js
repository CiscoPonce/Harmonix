/**
 * Given names / place-name hooks that show up in lyrics but are not
 * teachable vocabulary (Jude, Michelle, Eleanor…). Virtue/month/flower
 * words that are also names (hope, june, rose) stay out so they can be taught.
 */
const LYRIC_PROPER_NAMES = new Set([
  // Famous song-title / lyric names
  "jude", "michelle", "eleanor", "rigby", "layla", "roxanne", "jolene",
  "delilah", "cecilia", "angie", "adeline", "aline", "lolita", "copacabana",
  "rhiannon",
  "billie", "jean", "lucy", "caroline",
  "jane", "johnny", "john", "mary", "maria", "maría",
  "jesus", "jesús", "christ", "judas",
  "diane", "diana", "rita", "sara", "sarah", "susan", "suzanne",
  "jenny", "jennie", "jessica", "jennifer", "amanda",
  "david", "michael", "mike", "mick",
  "tommy", "jimmy", "james", "jack", "jackie",
  "bob", "bobby", "billy", "william", "willie",
  "harry", "harold", "henry", "frank", "frankie",
  "paul", "pablo", "pedro", "juan", "carlos", "diego",
  "lucia", "lucía", "sofia", "sofía", "anna", "anne",
  "elena", "helena", "isabel", "isabelle", "isabella",
  "carmen", "pilar", "lola", "pepe", "manolo", "manuela",
  "jose", "josé", "joseph",
  "pierre", "jacques", "francois", "françois", "marie",
  "giovanni", "giulia", "giuseppe", "francesco", "marco", "luca",
  "hans", "klaus", "ingrid", "greta",
  "leonor", "juana", "carolina",
  // Place-name hooks (not dictionary vocabulary we want to teach)
  "london", "hollywood", "broadway", "manhattan", "brooklyn",
  "california", "barcelona", "madrid", "lisboa", "lisbon",
  "moskva", "gorky",
]);

function foldName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¡!.,'"’`-]+/g, "")
    .trim();
}

function isLyricProperName(word) {
  const raw = String(word || "").toLowerCase().trim();
  if (!raw) return false;
  if (LYRIC_PROPER_NAMES.has(raw)) return true;
  const folded = foldName(raw);
  return Boolean(folded) && LYRIC_PROPER_NAMES.has(folded);
}

/** High-frequency verbs — teachable, but a poor first pick when a richer lyric exists. */
const LYRIC_LIGHT_VERBS = new Set([
  "make", "made", "take", "took", "taken", "get", "got", "give", "gave", "given",
  "put", "let", "go", "gone", "come", "came", "see", "saw", "seen",
  "know", "knew", "known", "want", "need", "say", "said", "tell", "told",
  "keep", "kept",
]);

function isLyricLightVerb(word) {
  return LYRIC_LIGHT_VERBS.has(String(word || "").toLowerCase().trim());
}

module.exports = {
  LYRIC_PROPER_NAMES,
  LYRIC_LIGHT_VERBS,
  isLyricProperName,
  isLyricLightVerb,
};
