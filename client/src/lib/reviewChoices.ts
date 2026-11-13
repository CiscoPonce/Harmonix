const SIMILAR_FALLBACK: Record<string, string[]> = {
  en: ['a small thing', 'another time', 'someone nearby'],
  es: ['algo pequeño', 'otro momento', 'alguien cerca'],
  fr: ['une petite chose', 'un autre moment', 'quelqu’un près'],
  de: ['etwas Kleines', 'ein anderer Moment', 'jemand in der Nähe'],
  pt: ['algo pequeno', 'outro momento', 'alguém perto'],
  it: ['qualcosa di piccolo', 'un altro momento', 'qualcuno vicino'],
};

const SILLY: Record<string, string[]> = {
  en: [
    'a sock sandwich',
    'the fridge’s cousin',
    'a cloud wearing shoes',
    'a singing toaster',
    'Tuesday’s pet rock',
    'a bicycle made of soup',
    'the moon’s left sock',
    'a polite thunderstorm',
  ],
  es: [
    'un sándwich de calcetines',
    'el primo del refrigerador',
    'una nube con zapatos',
    'una tostadora que canta',
    'la piedra mascota del martes',
    'una bicicleta de sopa',
    'el calcetín izquierdo de la luna',
    'una tormenta educada',
  ],
  fr: [
    'un sandwich de chaussettes',
    'le cousin du réfrigérateur',
    'un nuage à chaussures',
    'un grille-pain qui chante',
    'le caillou du mardi',
    'un vélo en soupe',
    'la chaussette gauche de la lune',
    'un orage poli',
  ],
  de: [
    'ein Sandwich aus Socken',
    'der Cousin des Kühlschranks',
    'eine Wolke mit Schuhen',
    'ein singender Toaster',
    'Dienstags Haustierstein',
    'ein Fahrrad aus Suppe',
    'die linke Socke des Mondes',
    'ein höfliches Gewitter',
  ],
  pt: [
    'um sanduíche de meias',
    'o primo da geladeira',
    'uma nuvem de sapatos',
    'uma torradeira que canta',
    'a pedra de estimação de terça',
    'uma bicicleta de sopa',
    'a meia esquerda da lua',
    'uma tempestade educada',
  ],
  it: [
    'un panino di calzini',
    'il cugino del frigorifero',
    'una nuvola con le scarpe',
    'un tostapane che canta',
    'il sasso di martedì',
    'una bici di zuppa',
    'il calzino sinistro della luna',
    'un temporale educato',
  ],
};

function keyOf(value: string) {
  return value.trim().toLowerCase();
}

function hashText(value: string) {
  let hash = 0;
  for (const char of keyOf(value)) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function tokens(value: string) {
  return keyOf(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2);
}

function similarity(correct: string, candidate: string) {
  const left = tokens(correct);
  const right = new Set(tokens(candidate));
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared * 100 - Math.abs(correct.length - candidate.length);
}

function pickSimilar(correct: string, pool: string[], blocked: Set<string>, lang: string) {
  let best: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const raw of pool) {
    const text = String(raw || '').trim();
    const key = keyOf(text);
    if (!text || blocked.has(key)) continue;
    const score = similarity(correct, text);
    if (score > bestScore || (score === bestScore && best != null && text.localeCompare(best) < 0)) {
      best = text;
      bestScore = score;
    }
  }
  if (best) return best;
  const fallback = SIMILAR_FALLBACK[lang] || SIMILAR_FALLBACK.en;
  return fallback.find((item) => !blocked.has(keyOf(item))) || fallback[0];
}

function pickSilly(correct: string, blocked: Set<string>, lang: string) {
  const jokes = SILLY[lang] || SILLY.en;
  const start = hashText(correct) % jokes.length;
  for (let step = 0; step < jokes.length; step += 1) {
    const joke = jokes[(start + step) % jokes.length];
    if (!blocked.has(keyOf(joke))) return joke;
  }
  return jokes[0];
}

/** Right meaning, the closest other meaning, and one silly meaning. Order is shuffled. */
export function buildReviewChoices(correct: string, pool: string[], lang = 'en'): string[] {
  const right = correct.trim();
  if (!right) return [];
  const language = (lang || 'en').toLowerCase();
  const blocked = new Set([keyOf(right)]);
  const similar = pickSimilar(right, pool, blocked, language);
  blocked.add(keyOf(similar));
  const silly = pickSilly(right, blocked, language);
  return shuffle([right, similar, silly]);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
