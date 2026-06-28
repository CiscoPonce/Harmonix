const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

function normalizeDifficulty(value) {
  const d = String(value || 'medium').toLowerCase().trim();
  return DIFFICULTY_LEVELS.includes(d) ? d : 'medium';
}

function cefrIndex(level) {
  const i = CEFR_ORDER.indexOf(level);
  return i >= 0 ? i : CEFR_ORDER.indexOf('B1');
}

function effectiveCefr(cefrLevel, difficulty) {
  const cefr = cefrLevel && CEFR_ORDER.includes(cefrLevel) ? cefrLevel : 'B1';
  const d = normalizeDifficulty(difficulty);
  if (d === 'easy') {
    return CEFR_ORDER[Math.min(cefrIndex(cefr), cefrIndex('A2'))];
  }
  if (d === 'hard') {
    return CEFR_ORDER[Math.max(cefrIndex(cefr), cefrIndex('B2'))];
  }
  return cefr;
}

function difficultyRubric(difficulty) {
  const d = normalizeDifficulty(difficulty);
  if (d === 'easy') {
    return `EASY mode — strict rules:
- Pick only high-frequency, concrete words (top ~500 in the language).
- Prefer 1–2 syllable words; no idioms, slang, or regionalisms.
- Label cefr_level A1 or A2 only. Set difficulty to "easy".`;
  }
  if (d === 'hard') {
    return `HARD mode — strict rules:
- Prefer idioms, slang, figurative language, nuanced synonyms, or culturally specific terms.
- Abstract or literary vocabulary is encouraged when it appears in the song.
- Label cefr_level B2, C1, or C2. Set difficulty to "hard".`;
  }
  return `MEDIUM mode — strict rules:
- Pick common B1-level words learners encounter in everyday speech and pop lyrics.
- Light phrasal verbs or common expressions are OK; avoid heavy slang.
- Label cefr_level A2, B1, or B2. Set difficulty to "medium".`;
}

function difficultyMatchScore(candidateDifficulty, userDifficulty) {
  const user = normalizeDifficulty(userDifficulty);
  const candidate = normalizeDifficulty(candidateDifficulty);
  if (candidate === user) return 3;
  const userIdx = DIFFICULTY_LEVELS.indexOf(user);
  const candIdx = DIFFICULTY_LEVELS.indexOf(candidate);
  if (Math.abs(userIdx - candIdx) === 1) return 1;
  return 0;
}

function cefrWithinBand(cefrLevel, effectiveLevel, difficulty) {
  if (!cefrLevel) return true;
  const idx = cefrIndex(cefrLevel);
  const d = normalizeDifficulty(difficulty);
  if (d === 'easy') return idx <= cefrIndex('A2');
  if (d === 'hard') return idx >= cefrIndex('B2');
  return idx >= cefrIndex('A2') && idx <= cefrIndex('B2');
}

function filterVocabularyByLevel(vocabulary, effectiveLevel, difficulty) {
  if (!Array.isArray(vocabulary) || vocabulary.length === 0) return vocabulary;
  const d = normalizeDifficulty(difficulty);

  const seen = new Set();
  const unique = vocabulary.filter((item) => {
    const key = String(item.word || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const matched = unique.filter((item) =>
    cefrWithinBand(item.cefr_level, effectiveLevel, d)
  );
  if (matched.length >= 3) return matched;

  const sorted = [...unique].sort(
    (a, b) =>
      Math.abs(cefrIndex(a.cefr_level) - cefrIndex(effectiveLevel))
      - Math.abs(cefrIndex(b.cefr_level) - cefrIndex(effectiveLevel))
  );
  const minCount = Math.min(3, unique.length);
  if (matched.length >= minCount) return matched;
  return sorted.slice(0, Math.max(minCount, matched.length));
}

module.exports = {
  CEFR_ORDER,
  DIFFICULTY_LEVELS,
  normalizeDifficulty,
  cefrIndex,
  effectiveCefr,
  difficultyRubric,
  difficultyMatchScore,
  cefrWithinBand,
  filterVocabularyByLevel,
};
