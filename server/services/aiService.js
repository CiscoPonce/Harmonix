const { OpenAI } = require('openai');
const { difficultyRubric, normalizeDifficulty } = require('../constants/difficulty');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || 'missing-nim-key',
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: 60000, maxRetries: 0,
});

// Short-timeout NIM client for user-facing gloss / next-word (avoid 20–60s stalls).
const openaiFast = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || 'missing-nim-key',
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: parseInt(process.env.NIM_FAST_TIMEOUT_MS || '10000', 10),
  maxRetries: 0,
});

const openrouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    // Free-tier OR models can hang; fail fast so NIM/other fallbacks stay snappy.
    timeout: parseInt(process.env.OPENROUTER_TIMEOUT_MS || '15000', 10),
    maxRetries: 0,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://harmonix.app',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Harmonix',
    },
  })
  : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const modelsEnv = process.env.NVIDIA_NIM_MODELS || process.env.NVIDIA_NIM_MODEL;
const AVAILABLE_MODELS = modelsEnv
  ? modelsEnv.split(',').map(m => m.trim())
  : [
      // 2026-09-05 live NIM bench (gloss "brings"→"trae"): llama-3.1-8b / nano-9b /
      // step-3.7-flash now 410. Muse ~650–830ms + follows JSON guardrails.
      // Lightning-on-NIM is alive but ~4.3s and dumps thinking into content.
      'meta/muse-glimmer-30b',
      'minimaxai/minimax-m3',
      'nvidia/nemotron-3.5-lightning-30b-a3b',
    ];

const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS
  || 'nvidia/nemotron-3.5-lightning:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const FAST_MODELS = [
  'meta/muse-glimmer-30b',
  'minimaxai/minimax-m3',
];

const NIM_COOLDOWN_MS = parseInt(process.env.NIM_RATE_LIMIT_COOLDOWN_MS || '300000', 10);
let nimRateLimitedUntil = 0;

function isNimInCooldown() {
  return Date.now() < nimRateLimitedUntil;
}

function markNimRateLimited() {
  nimRateLimitedUntil = Date.now() + NIM_COOLDOWN_MS;
  console.warn(`NVIDIA rate-limited — using OpenRouter first for ${Math.round(NIM_COOLDOWN_MS / 1000)}s`);
}

function isRateLimitError(err) {
  return err && (err.status === 429 || String(err.message || '').includes('429'));
}

function isNimAuthError(err) {
  return err && (
    err.status === 401
    || /api key expired|unauthorized/i.test(String(err.message || ''))
  );
}

function isRetryableError(err) {
  return isRateLimitError(err)
    || err?.status === 404
    || err?.status === 410
    || (err?.status >= 500 && err?.status < 600);
}

function buildModelAttempts(primaryModel, { fast = false } = {}) {
  const nimClient = fast ? openaiFast : openai;
  const nimChain = fast
    ? [...new Set([primaryModel, ...FAST_MODELS])]
    : [primaryModel, ...AVAILABLE_MODELS.filter((m) => m !== primaryModel)];

  const attempts = [];
  const skipNim = isNimInCooldown();

  // User-facing fast path: NIM first (Muse is the live, sub-second gloss model).
  // OpenRouter is next if the NIM key/models fail — not first, because a dead
  // OpenRouter key adds ~200ms of 401s before every word.
  if (fast) {
    if (!skipNim) {
      for (const model of nimChain) {
        attempts.push({ client: nimClient, provider: 'nvidia', model });
      }
    }
    if (openrouter) {
      for (const model of OPENROUTER_MODELS) {
        attempts.push({ client: openrouter, provider: 'openrouter', model });
      }
    }
    return attempts;
  }

  const nimPrimary = nimChain[0];
  if (nimPrimary && !skipNim) {
    attempts.push({ client: nimClient, provider: 'nvidia', model: nimPrimary });
  }

  if (openrouter) {
    for (const model of OPENROUTER_MODELS) {
      attempts.push({ client: openrouter, provider: 'openrouter', model });
    }
  }

  if (!skipNim) {
    for (const model of nimChain.slice(1)) {
      attempts.push({ client: nimClient, provider: 'nvidia', model });
    }
  } else if (!openrouter) {
    for (const model of nimChain.slice(1)) {
      attempts.push({ client: nimClient, provider: 'nvidia', model });
    }
  }

  return attempts;
}

async function tryChatCompletion(params, { fast = false, label = 'ChatCompletion' } = {}) {
  const primaryModel = params.model || (fast ? FAST_MODELS[0] : AVAILABLE_MODELS[0]);
  const attempts = buildModelAttempts(primaryModel, { fast });
  let lastErr = null;

  for (const { client, provider, model } of attempts) {
    try {
      console.log(`Calling ${label} [${provider}] model: ${model}`);
      return await client.chat.completions.create({ ...params, model });
    } catch (err) {
      lastErr = err;
      if (provider === 'nvidia' && (isRateLimitError(err) || isNimAuthError(err))) {
        markNimRateLimited();
      }
      console.warn(`${label} [${provider}] ${model} failed: ${err.message || err}. Status: ${err.status}`);
      if (isRetryableError(err)) {
        console.warn(`Attempting fallback to next model...`);
        continue;
      }
      console.warn(`Attempting fallback to next model due to error...`);
      continue;
    }
  }

  throw lastErr || new Error('All chat completion models failed');
}

async function createChatCompletion(params) {
  return tryChatCompletion(params, { fast: false, label: 'ChatCompletion' });
}

function parseJsonContent(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

function normalizeSingleDailyWord(content) {
  if (!content || typeof content !== 'object') return null;
  if (content.target_word && content.song_title && content.artist) return content;
  const nested = content.daily_word || content.word || content.result || content.data;
  if (nested && typeof nested === 'object') {
    return {
      target_word: nested.target_word || nested.word || nested.text,
      translation: nested.translation || content.translation,
      part_of_speech: nested.part_of_speech || content.part_of_speech,
      pronunciation: nested.pronunciation || content.pronunciation,
      difficulty: nested.difficulty || content.difficulty,
      cefr_level: nested.cefr_level || content.cefr_level,
      song_title: nested.song_title || nested.title || content.song_title,
      artist: nested.artist || content.artist,
      genre: nested.genre || content.genre,
    };
  }
  return {
    target_word: content.target_word || content.word || content.text,
    translation: content.translation,
    part_of_speech: content.part_of_speech,
    pronunciation: content.pronunciation,
    difficulty: content.difficulty,
    cefr_level: content.cefr_level,
    song_title: content.song_title || content.title,
    artist: content.artist,
    genre: content.genre,
  };
}

function normalizeDailyWord(content) {
  if (!content || typeof content !== 'object') return null;
  if (Array.isArray(content.candidates)) {
    return content.candidates.map(c => normalizeSingleDailyWord(c)).filter(Boolean);
  }
  if (Array.isArray(content)) {
    return content.map(c => normalizeSingleDailyWord(c)).filter(Boolean);
  }
  const single = normalizeSingleDailyWord(content);
  return single ? [single] : null;
}

async function extractVocabulary(lyricsText, targetLanguage, cefrLevel = 'B1', difficulty = 'medium') {
  const level = cefrLevel || 'B1';
  const diff = normalizeDifficulty(difficulty);
  const rubric = difficultyRubric(diff);

  const systemPrompt = `Act as a professional ${targetLanguage} teacher. Your task is to analyze song lyrics and extract 5-10 vocabulary words or phrases.
Target Audience Level: ${level}.
Difficulty setting: ${diff}

${rubric}

Constraints:
1. Words must be essential for understanding the song's themes.
2. Words should match BOTH the CEFR level (${level}) AND the difficulty setting (${diff}).
3. For A1/A2: Avoid idioms, focus on high-frequency concrete nouns and verbs.
4. For B1/B2: Include common phrasal verbs and situational expressions.
5. For C1/C2: Focus on nuanced synonyms, literary terms, and culturally specific metaphors.
6. Every item MUST include an accurate cefr_level label (A1-C2).

Output Format (JSON):
{
  "vocabulary": [
    {
      "word": "original_word_in_lyrics",
      "lemma": "dictionary_form",
      "definition": "context_aware_definition",
      "cefr_level": "A1-C2",
      "reason": "why this word was chosen"
    }
  ]
}`;

  const response = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Lyrics:\n${lyricsText}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 16384,
    temperature: 0.6,
    top_p: 0.95,
  });

  const content = JSON.parse(response.choices[0].message.content);
  return content.vocabulary;
}

async function generateDailyWord({ languageName, cefrLevel, genre, difficulty, avoidWords = [] }) {
  const avoidList = avoidWords.length
    ? `Avoid these recently used words: ${avoidWords.join(', ')}.`
    : '';
  const diff = normalizeDifficulty(difficulty);
  const rubric = difficultyRubric(diff);

  const systemPrompt = `You are a ${languageName} language teacher. Pick 5 DIFFERENT vocabulary words for a learner. Pair each word with a REAL, well-known ${languageName} song that contains that exact word in its lyrics.

Learner CEFR level: ${cefrLevel}
Preferred genre: ${genre}
Difficulty setting: ${diff}

${rubric}

Rules:
1. Each target_word MUST appear verbatim (same spelling) in its matching song lyrics — verify before responding.
2. Choose globally known hit songs that exist on Deezer with a 30s preview. Use exact official artist and song_title as listed on Deezer (main artist only, no "feat." in artist field).
3. Pick songs that have synced lyrics on LRCLib (well-known Latin/pop hits work best).
4. Every candidate MUST match BOTH the CEFR level (${cefrLevel}) AND difficulty (${diff}).
5. Return realistic song_title and artist names only — no made-up songs.
6. Each candidate MUST include cefr_level (A1-C2) and difficulty (easy|medium|hard) matching the rules above.
7. Each candidate MUST include pronunciation as IPA or readable phonetic spelling for the target_word.
8. ${avoidList}

Reply with ONLY a JSON object containing a "candidates" array, no markdown or explanation:
{
  "candidates": [
    {
      "target_word": "word in lyrics",
      "translation": "short gloss in the learner's HOME/native language (not English unless native is English)",
      "part_of_speech": "noun|verb|adjective|...",
      "pronunciation": "IPA phonetic spelling, e.g. /eŋ.konˈtɾar/",
      "cefr_level": "A1-C2",
      "difficulty": "easy|medium|hard",
      "song_title": "Song Title",
      "artist": "Artist Name",
      "genre": "genre label"
    }
  ]
}`;

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate 5 ${languageName} word-of-the-day candidates with matching songs.` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 16384,
        temperature: 0.4,
        top_p: 0.95,
      });

      const raw = response.choices?.[0]?.message?.content;
      const parsed = normalizeDailyWord(parseJsonContent(raw));
      if (!parsed || parsed.length === 0) {
        lastErr = new Error('invalid_ai_daily_word_response');
        continue;
      }
      return parsed;
    } catch (err) {
      if (isRateLimitError(err)) {
        const e = new Error('ai_rate_limit');
        e.code = 'ai_rate_limit';
        throw e;
      }
      lastErr = err;
    }
  }

  throw lastErr || new Error('invalid_ai_daily_word_response');
}

const VERIFIED_SONGS = {
  es: [
    { song_title: 'Vivir Mi Vida', artist: 'Marc Anthony', genre: 'pop' },
    { song_title: 'Despacito', artist: 'Luis Fonsi', genre: 'reggaeton' },
    { song_title: 'Gasolina', artist: 'Daddy Yankee', genre: 'reggaeton' },
    { song_title: 'La Bicicleta', artist: 'Carlos Vives', genre: 'pop' },
    { song_title: 'Propuesta Indecente', artist: 'Romeo Santos', genre: 'pop' },
    { song_title: 'Con Calma', artist: 'Daddy Yankee', genre: 'reggaeton' },
    { song_title: 'Tití Me Preguntó', artist: 'Bad Bunny', genre: 'reggaeton' },
    { song_title: 'Me Porto Bonito', artist: 'Bad Bunny', genre: 'reggaeton' },
    { song_title: 'Yo Perreo Sola', artist: 'Bad Bunny', genre: 'reggaeton' },
    { song_title: 'Dákiti', artist: 'Bad Bunny', genre: 'reggaeton' },
    { song_title: 'Felices los 4', artist: 'Maluma', genre: 'pop' },
    { song_title: 'Corazón', artist: 'Maluma', genre: 'pop' },
    { song_title: 'Sin Pijama', artist: 'Becky G', genre: 'reggaeton' },
    { song_title: 'Échame La Culpa', artist: 'Luis Fonsi', genre: 'pop' },
    { song_title: 'Bailando', artist: 'Enrique Iglesias', genre: 'pop' },
    { song_title: 'Ella Me Levantó', artist: 'Aventura', genre: 'pop' },
    { song_title: 'Obsesión', artist: 'Aventura', genre: 'pop' },
    { song_title: 'Danza Kuduro', artist: 'Don Omar', genre: 'reggaeton' },
    { song_title: 'Pepas', artist: 'Farruko', genre: 'reggaeton' },
    { song_title: 'Hawái', artist: 'Maluma', genre: 'pop' },
    { song_title: 'A Dios le Pido', artist: 'Juanes', genre: 'rock' },
    { song_title: 'La Camisa Negra', artist: 'Juanes', genre: 'rock' },
    { song_title: 'Color Esperanza', artist: 'Diego Torres', genre: 'pop' },
    { song_title: 'Tusa', artist: 'Karol G', genre: 'reggaeton' },
    { song_title: 'Baila Baila Baila', artist: 'Ozuna', genre: 'reggaeton' },
    { song_title: 'Te Boté', artist: 'Casper Magico', genre: 'reggaeton' },
    { song_title: 'Mi Gente', artist: 'J Balvin', genre: 'reggaeton' },
    { song_title: 'X', artist: 'Nicki Minaj', genre: 'reggaeton' },
    { song_title: 'Baila Conmigo', artist: 'Selena Gomez', genre: 'pop' },
    { song_title: 'Amor Prohibido', artist: 'Selena', genre: 'pop' },
    { song_title: 'Bidi Bidi Bom Bom', artist: 'Selena', genre: 'pop' },
    { song_title: 'Fuiste Tú', artist: 'Ricardo Arjona', genre: 'pop' },
    { song_title: 'Creo En Ti', artist: 'Reik', genre: 'pop' },
    { song_title: 'Espacio Sideral', artist: 'Jesse & Joy', genre: 'pop' },
    { song_title: 'En El Muelle de San Blas', artist: 'Maná', genre: 'rock' },
    { song_title: 'Clavado en Un Bar', artist: 'Maná', genre: 'rock' },
    { song_title: 'Rayando el Sol', artist: 'Maná', genre: 'rock' },
    { song_title: 'El Perdón', artist: 'Nicky Jam', genre: 'reggaeton' },
    { song_title: 'Hasta el Amanecer', artist: 'Nicky Jam', genre: 'reggaeton' },
    { song_title: 'Caramelo', artist: 'Ozuna', genre: 'reggaeton' },
    { song_title: 'Se Preparó', artist: 'Ozuna', genre: 'reggaeton' },
    { song_title: 'Sofía', artist: 'Alvaro Soler', genre: 'pop' },
    { song_title: 'La Gozadera', artist: 'Marc Anthony', genre: 'pop' },
    { song_title: 'Vivir Así Es Morir de Amor', artist: 'Camilo Sesto', genre: 'pop' },
    { song_title: 'Latinoamérica', artist: 'Calle 13', genre: 'hip-hop' },
    { song_title: 'Atrévete-te-te', artist: 'Calle 13', genre: 'hip-hop' },
    { song_title: 'Pa\'l Norte', artist: 'Calle 13', genre: 'hip-hop' },
    { song_title: '1977', artist: 'Ana Tijoux', genre: 'hip-hop' },
    { song_title: 'Labios Compartidos', artist: 'Maná', genre: 'rock' },
    { song_title: 'Flaca', artist: 'Andrés Calamaro', genre: 'rock' },
  ],
  // Proven LRCLib hits first; secondary titles are fallbacks for pool size.
  en: [
    { song_title: 'Bad Guy', artist: 'Billie Eilish', genre: 'pop' },
    { song_title: 'Shallow', artist: 'Lady Gaga', genre: 'pop' },
    { song_title: 'Rolling in the Deep', artist: 'Adele', genre: 'pop' },
    { song_title: 'Heat Waves', artist: 'Glass Animals', genre: 'pop' },
    { song_title: 'Someone You Loved', artist: 'Lewis Capaldi', genre: 'pop' },
    { song_title: 'Mr. Brightside', artist: 'The Killers', genre: 'rock' },
    { song_title: 'Demons', artist: 'Imagine Dragons', genre: 'rock' },
    { song_title: 'Hello', artist: 'Adele', genre: 'pop' },
    { song_title: 'Stay With Me', artist: 'Sam Smith', genre: 'pop' },
    { song_title: 'Photograph', artist: 'Ed Sheeran', genre: 'pop' },
    { song_title: 'Happier', artist: 'Marshmello', genre: 'pop' },
    { song_title: 'Royals', artist: 'Lorde', genre: 'pop' },
    { song_title: 'Radioactive', artist: 'Imagine Dragons', genre: 'rock' },
    { song_title: 'Believer', artist: 'Imagine Dragons', genre: 'rock' },
    { song_title: 'Yellow', artist: 'Coldplay', genre: 'rock' },
    { song_title: 'Viva La Vida', artist: 'Coldplay', genre: 'rock' },
    { song_title: 'Shape of You', artist: 'Ed Sheeran', genre: 'pop' },
    { song_title: 'Blinding Lights', artist: 'The Weeknd', genre: 'pop' },
    { song_title: 'Someone Like You', artist: 'Adele', genre: 'pop' },
    { song_title: 'Counting Stars', artist: 'OneRepublic', genre: 'pop' },
    { song_title: 'Lose Yourself', artist: 'Eminem', genre: 'hip-hop' },
    { song_title: 'Not Afraid', artist: 'Eminem', genre: 'hip-hop' },
    { song_title: 'Stronger', artist: 'Kanye West', genre: 'hip-hop' },
    { song_title: 'In Da Club', artist: '50 Cent', genre: 'hip-hop' },
  ],
  fr: [
    { song_title: 'Formidable', artist: 'Stromae', genre: 'pop' },
    { song_title: 'On écrit sur les murs', artist: 'Kids United', genre: 'pop' },
    { song_title: 'Mistral gagnant', artist: 'Renaud', genre: 'rock' },
    { song_title: 'Tourner dans le vide', artist: 'Indila', genre: 'pop' },
    { song_title: 'Je veux', artist: 'Zaz', genre: 'pop' },
    { song_title: 'Comme des enfants', artist: 'Cœur de pirate', genre: 'rock' },
    { song_title: 'Avant nous', artist: 'Soprano', genre: 'pop' },
    { song_title: 'Dernière Danse', artist: 'Indila', genre: 'pop' },
    { song_title: 'Papaoutai', artist: 'Stromae', genre: 'pop' },
    { song_title: 'Alors on danse', artist: 'Stromae', genre: 'pop' },
    { song_title: 'Tous les mêmes', artist: 'Stromae', genre: 'pop' },
    { song_title: 'Elle me dit', artist: 'MIKA', genre: 'pop' },
    { song_title: 'Balance ton quoi', artist: 'Angèle', genre: 'pop' },
    { song_title: 'Pour que tu m\'aimes encore', artist: 'Céline Dion', genre: 'pop' },
    { song_title: 'Désenchantée', artist: 'Mylène Farmer', genre: 'pop' },
    { song_title: 'Carmen', artist: 'Stromae', genre: 'pop' },
  ],
  de: [
    // German-language lyrics only — never English hits by German bands (Wind of Change, etc.)
    { song_title: 'Atemlos durch die Nacht', artist: 'Helene Fischer', genre: 'pop' },
    { song_title: 'Männer', artist: 'Herbert Grönemeyer', genre: 'pop' },
    { song_title: '99 Luftballons', artist: 'Nena', genre: 'pop' },
    { song_title: 'Du hast', artist: 'Rammstein', genre: 'rock' },
    { song_title: 'Durch den Monsun', artist: 'Tokio Hotel', genre: 'rock' },
    { song_title: 'Über sieben Brücken', artist: 'Peter Maffay', genre: 'rock' },
    { song_title: 'Engel', artist: 'Rammstein', genre: 'rock' },
    { song_title: 'Ohne dich', artist: 'Rammstein', genre: 'rock' },
    { song_title: 'Zeit', artist: 'Rammstein', genre: 'rock' },
    { song_title: 'Deutschland', artist: 'Rammstein', genre: 'rock' },
    { song_title: 'Ausländer', artist: 'Rammstein', genre: 'rock' },
    { song_title: 'Major Tom (völlig losgelöst)', artist: 'Peter Schilling', genre: 'rock' },
    { song_title: 'Schrei nach Liebe', artist: 'Die Ärzte', genre: 'rock' },
    { song_title: 'Leider geil', artist: 'Deichkind', genre: 'pop' },
    { song_title: 'Auf uns', artist: 'Andreas Bourani', genre: 'pop' },
    { song_title: 'Tage wie diese', artist: 'Die Toten Hosen', genre: 'rock' },
    { song_title: 'Das Beste', artist: 'Silbermond', genre: 'pop' },
    { song_title: 'Perfekte Welle', artist: 'Juli', genre: 'pop' },
    { song_title: 'Nur ein Wort', artist: 'Wir sind Helden', genre: 'rock' },
    { song_title: 'Dieser Weg', artist: 'Xavier Naidoo', genre: 'pop' },
  ],
  pt: [
    // Portuguese / Brazilian hits only — avoid Spanish or Spanglish Anitta tracks (Downtown, etc.)
    { song_title: 'Ai Se Eu Te Pego', artist: 'Michel Teló', genre: 'pop' },
    { song_title: 'Envolver', artist: 'Anitta', genre: 'pop' },
    { song_title: 'Garota de Ipanema', artist: 'Tom Jobim', genre: 'pop' },
    { song_title: 'Balada', artist: 'Gusttavo Lima', genre: 'pop' },
    { song_title: 'Deixa Alagar', artist: 'Gusttavo Lima', genre: 'pop' },
    { song_title: 'Olha a Explosão', artist: 'MC Kevinho', genre: 'pop' },
    { song_title: 'Bola Rebola', artist: 'Tropkillaz', genre: 'pop' },
    { song_title: 'Evidências', artist: 'Chitãozinho & Xororó', genre: 'pop' },
    { song_title: 'O Sol', artist: 'Vitor Kley', genre: 'pop' },
    { song_title: 'Amo Noite e Dia', artist: 'Pedro Sampaio', genre: 'pop' },
    { song_title: 'Parabéns', artist: 'Anitta', genre: 'pop' },
    { song_title: 'Você Partiu Meu Coração', artist: 'Matheus & Kauan', genre: 'pop' },
    { song_title: 'Chega de Saudade', artist: 'João Gilberto', genre: 'pop' },
    { song_title: 'Mas Que Nada', artist: 'Sérgio Mendes', genre: 'pop' },
    { song_title: 'Aquarela', artist: 'Toquinho', genre: 'pop' },
    { song_title: 'Show das Poderosas', artist: 'Anitta', genre: 'pop' },
    { song_title: 'Infiel', artist: 'Marília Mendonça', genre: 'pop' },
    { song_title: 'Eduardo e Mônica', artist: 'Legião Urbana', genre: 'rock' },
  ],
  it: [
    { song_title: 'Zitti e buoni', artist: 'Måneskin', genre: 'rock' },
    { song_title: 'Più bella cosa', artist: 'Eros Ramazzotti', genre: 'pop' },
    { song_title: 'Sere nere', artist: 'Tiziano Ferro', genre: 'pop' },
    { song_title: 'Guerriero', artist: 'Marco Mengoni', genre: 'pop' },
    { song_title: 'Con te partirò', artist: 'Andrea Bocelli', genre: 'pop' },
    { song_title: 'Sarà perché ti amo', artist: 'Ricchi e Poveri', genre: 'pop' },
    { song_title: 'Certe Notti', artist: 'Ligabue', genre: 'rock' },
    { song_title: 'Gloria', artist: 'Umberto Tozzi', genre: 'pop' },
    { song_title: 'Laura non c\'è', artist: 'Nek', genre: 'pop' },
    { song_title: 'Vivo per lei', artist: 'Andrea Bocelli', genre: 'pop' },
    { song_title: 'L\'essenziale', artist: 'Marco Mengoni', genre: 'pop' },
    { song_title: 'Un\'altra te', artist: 'Eros Ramazzotti', genre: 'pop' },
    { song_title: 'Bello e impossibile', artist: 'Gianna Nannini', genre: 'rock' },
    { song_title: 'Felicità', artist: 'Al Bano & Romina Power', genre: 'pop' },
    { song_title: 'Penso Positivo', artist: 'Jovanotti', genre: 'pop' },
    { song_title: 'A te', artist: 'Jovanotti', genre: 'pop' },
  ],
};

function normalizeGenre(genre) {
  const g = String(genre || 'pop').toLowerCase().trim();
  if (g === 'hiphop' || g === 'hip hop' || g === 'rap') return 'hip-hop';
  if (g === 'latin' || g === 'urbano' || g === 'urban') return 'reggaeton';
  const allowed = new Set(['any', 'pop', 'rock', 'hip-hop', 'reggaeton']);
  return allowed.has(g) ? g : 'pop';
}

/** Candidate genre for matching — unknown labels fail closed (do not collapse to pop). */
function normalizeCandidateGenre(genre) {
  if (genre == null || String(genre).trim() === '') return null;
  const g = String(genre).toLowerCase().trim();
  if (g === 'hiphop' || g === 'hip hop' || g === 'rap') return 'hip-hop';
  if (g === 'latin' || g === 'urbano' || g === 'urban') return 'reggaeton';
  const allowed = new Set(['pop', 'rock', 'hip-hop', 'reggaeton']);
  return allowed.has(g) ? g : null;
}

function genresCompatible(candidateGenre, userGenre) {
  const u = normalizeGenre(userGenre);
  if (u === 'any') return true;
  const c = normalizeCandidateGenre(candidateGenre);
  if (!c) return false;
  return c === u;
}

function songCandidateKey(song) {
  return `${String(song.artist || '').toLowerCase()}|${String(song.song_title || song.title || '').toLowerCase()}`;
}

/** Verified catalog genre index for a language (single source of truth). */
function verifiedGenreIndex(languageCode) {
  const map = new Map();
  for (const s of VERIFIED_SONGS[normalizeLanguageCode(languageCode)] || []) {
    const genre = normalizeCandidateGenre(s.genre);
    if (genre) map.set(songCandidateKey(s), genre);
  }
  return map;
}

function getVerifiedSongCandidates(languageCode, genre) {
  const langCode = normalizeLanguageCode(languageCode);
  const list = VERIFIED_SONGS[langCode] || [];
  const g = normalizeGenre(genre);
  if (g === 'any') return list.slice();
  // Empty when this style has no verified songs — never fall back to mislabeled curated.
  return list.filter((s) => genresCompatible(s.genre, g));
}

const GENRE_HIT_EXAMPLES = {
  es: {
    reggaeton: 'Gasolina (Daddy Yankee), Despacito (Luis Fonsi), Dákiti (Bad Bunny), Tití Me Preguntó (Bad Bunny), Con Calma (Daddy Yankee), Me Porto Bonito (Bad Bunny), Yo Perreo Sola (Bad Bunny), Pepas (Farruko), Danza Kuduro (Don Omar), Taki Taki (DJ Snake), Mi Gente (J Balvin), Tusa (Karol G), El Perdón (Nicky Jam), Caramelo (Ozuna)',
    pop: 'Bailando (Enrique Iglesias), Vivir Mi Vida (Marc Anthony), La Bicicleta (Carlos Vives), Propuesta Indecente (Romeo Santos), Color Esperanza (Diego Torres), Sofía (Alvaro Soler), Fuiste Tú (Ricardo Arjona), Creo En Ti (Reik), Espacio Sideral (Jesse & Joy)',
    rock: 'A Dios le Pido (Juanes), La Camisa Negra (Juanes), En El Muelle de San Blas (Maná), Clavado en Un Bar (Maná), Rayando el Sol (Maná), Labios Compartidos (Maná), Flaca (Andrés Calamaro), Cuando Pase El Temblor (Soda Stereo)',
    'hip-hop': 'Latinoamérica (Calle 13), Atrévete-te-te (Calle 13), Pa\'l Norte (Calle 13), 1977 (Ana Tijoux), Mírala Miralo (Control Machete)',
    any: 'Bailando (Enrique Iglesias), Gasolina (Daddy Yankee), Vivir Mi Vida (Marc Anthony), La Bicicleta (Carlos Vives), Propuesta Indecente (Romeo Santos)',
  },
  en: {
    pop: 'Bad Guy (Billie Eilish), Shallow (Lady Gaga), Rolling in the Deep (Adele), Heat Waves (Glass Animals), Someone You Loved (Lewis Capaldi), Hello (Adele), Stay With Me (Sam Smith)',
    rock: 'Mr. Brightside (The Killers), Demons (Imagine Dragons), Radioactive (Imagine Dragons), Yellow (Coldplay), Believer (Imagine Dragons), Viva La Vida (Coldplay)',
    'hip-hop': 'Lose Yourself (Eminem), Not Afraid (Eminem), HUMBLE. (Kendrick Lamar), God\'s Plan (Drake), Stronger (Kanye West), In Da Club (50 Cent), Empire State of Mind (Jay-Z)',
    any: 'Bad Guy (Billie Eilish), Rolling in the Deep (Adele), Heat Waves (Glass Animals), Mr. Brightside (The Killers)',
  },
  fr: {
    pop: 'Formidable (Stromae), On écrit sur les murs (Kids United), Tourner dans le vide (Indila), Je veux (Zaz), Avant nous (Soprano), Dernière Danse (Indila), Papaoutai (Stromae)',
    rock: 'Mistral gagnant (Renaud), Comme des enfants (Cœur de pirate), Homme Contant (Noir Désir), Le vent nous portera (Noir Désir), Dis-moi (BB Brunes)',
    'hip-hop': 'Ailleurs (Orelsan), Basique (Orelsan), Tout va bien (Orelsan), Feu (Nekfeu), J\'suis pas bon (Nekfeu)',
    any: 'Formidable (Stromae), Je veux (Zaz), Mistral gagnant (Renaud), Tourner dans le vide (Indila)',
  },
  de: {
    pop: 'Atemlos durch die Nacht (Helene Fischer), Männer (Herbert Grönemeyer), 99 Luftballons (Nena), Auf uns (Andreas Bourani), Das Beste (Silbermond), Perfekte Welle (Juli)',
    rock: 'Du hast (Rammstein), Durch den Monsun (Tokio Hotel), Engel (Rammstein), Tage wie diese (Die Toten Hosen), Nur ein Wort (Wir sind Helden)',
    'hip-hop': 'Willst Du (Alligatoah), Fremdgehen (Alligatoah), Du bist schön (Alligatoah), Traurig (Apache 207), Roller (Apache 207)',
    any: 'Atemlos durch die Nacht (Helene Fischer), Männer (Herbert Grönemeyer), 99 Luftballons (Nena), Du hast (Rammstein), Das Beste (Silbermond)',
  },
  pt: {
    pop: 'Ai Se Eu Te Pego (Michel Teló), Envolver (Anitta), Garota de Ipanema (Tom Jobim), Balada (Gusttavo Lima), Olha a Explosão (MC Kevinho), Evidências (Chitãozinho & Xororó), Show das Poderosas (Anitta), Infiel (Marília Mendonça)',
    rock: 'Eduardo e Mônica (Legião Urbana), Tempo Perdido (Legião Urbana), Pais e Filhos (Legião Urbana), Anna Júlia (Los Hermanos), É Preciso Saber Viver (Titãs)',
    'hip-hop': 'Rap é Compromisso (Racionais MC\'s), Diário de um Detento (Racionais MC\'s), Negro Drama (Racionais MC\'s)',
    any: 'Ai Se Eu Te Pego (Michel Teló), Envolver (Anitta), Garota de Ipanema (Tom Jobim), Balada (Gusttavo Lima), Olha a Explosão (MC Kevinho)',
  },
  it: {
    pop: 'Più bella cosa (Eros Ramazzotti), Sere nere (Tiziano Ferro), Guerriero (Marco Mengoni), Con te partirò (Andrea Bocelli), Sarà perché ti amo (Ricchi e Poveri), Gloria (Umberto Tozzi), Laura non c\'è (Nek)',
    rock: 'Zitti e buoni (Måneskin), Certe Notti (Ligabue), Bello e impossibile (Gianna Nannini), Urlando contro il cielo (Ligabue), Meraviglioso (Negramaro)',
    'hip-hop': 'Starboy (Sfera Ebbasta), Pablo (Sfera Ebbasta), Madonna (Sfera Ebbasta), Cosa nostra (Marracash), Brutti e cattivi (Guè)',
    any: 'Zitti e buoni (Måneskin), Più bella cosa (Eros Ramazzotti), Sere nere (Tiziano Ferro), Guerriero (Marco Mengoni)',
  },
};

function normalizeLanguageCode(code) {
  return String(code || 'es').toLowerCase();
}

function genreExamplesForLanguage(languageCode, genre) {
  const byLang = GENRE_HIT_EXAMPLES[normalizeLanguageCode(languageCode)] || GENRE_HIT_EXAMPLES.es;
  const g = normalizeGenre(genre);
  if (g === 'any') return byLang.any || '';
  return byLang[g] || '';
}

function parseCuratedSongs(hitsString, genre) {
  const results = [];
  const re = /([^,(]+?)\s*\(([^)]+)\)/g;
  let match;
  while ((match = re.exec(hitsString)) !== null) {
    results.push({
      song_title: match[1].trim(),
      artist: match[2].trim(),
      genre: genre || 'pop',
    });
  }
  return results;
}

function getCuratedSongCandidates(languageCode, genre) {
  const langCode = normalizeLanguageCode(languageCode);
  const g = normalizeGenre(genre);
  const byLang = GENRE_HIT_EXAMPLES[langCode] || GENRE_HIT_EXAMPLES.es;
  const hits = byLang[g] || (g === 'any' ? byLang.any : '');
  if (!hits) {
    // Thin genre×language — return empty rather than mislabeled "any" songs.
    return [];
  }
  const verified = verifiedGenreIndex(langCode);
  const parsed = parseCuratedSongs(hits, g === 'any' ? 'pop' : g);
  return parsed.filter((song) => {
    const known = verified.get(songCandidateKey(song));
    if (known) {
      // Verified catalog wins — never serve a song under the wrong style stamp.
      song.genre = known;
      return g === 'any' || known === g;
    }
    return g === 'any' || genresCompatible(song.genre, g);
  });
}

async function createFastChatCompletion(params, timeoutMs = 12000) {
  const work = tryChatCompletion(params, { fast: true, label: 'fast ChatCompletion' });

  return Promise.race([
    work,
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error('ai_timeout');
        err.code = 'ai_timeout';
        reject(err);
      }, timeoutMs);
    }),
  ]);
}

async function generateDailyWordSongs({ languageName, languageCode, genre, difficulty, avoidSongs = [], spotifyTopArtists = [] }) {
  const langCode = normalizeLanguageCode(languageCode);
  const genreNorm = normalizeGenre(genre);
  const hits = genreExamplesForLanguage(langCode, genreNorm);
  const avoidList = avoidSongs.length
    ? `NEVER pick these already-used songs: ${avoidSongs.map((k) => k.replace("|", " - ")).join("; ")}.`
    : "";

  const spotifyArtistsGuard = Array.isArray(spotifyTopArtists) && spotifyTopArtists.length > 0
    ? `\n13. USER SPOTIFY FAVORITES: The user loves listening to these artists: ${spotifyTopArtists.slice(0, 10).join(', ')}. If any of these artists (or similar artists in the same style) have famous ${languageName}-language songs, PRIORITIZE picking their tracks!`
    : '';

  const languageConfusionGuard = langCode === 'pt'
    ? `\n11. CRITICAL for Portuguese: Do NOT pick Spanish-language songs. Never return Latin-pop Spanish hits (Maluma, Bad Bunny, Luis Fonsi, Romeo Santos, Marc Anthony, Daddy Yankee, Enrique Iglesias). Prefer Brazilian/Portuguese artists (Anitta Portuguese tracks, Michel Teló, Gusttavo Lima, Marília Mendonça, Legião Urbana, Tom Jobim). Reject Spanglish titles like Downtown / El Que Espera.`
    : langCode === 'es'
      ? `\n11. CRITICAL for Spanish: Do NOT pick Portuguese/Brazilian-only tracks as Spanish vocabulary sources.`
      : langCode === 'de'
        ? `\n11. CRITICAL for German: Songs MUST have primarily German lyrics. NEVER pick English songs by German artists (Wind of Change by Scorpions, Major Tom Coming Home English version, English Rammstein covers). Prefer Helene Fischer, Grönemeyer, Nena, Rammstein (German tracks), Tokio Hotel German tracks, Die Toten Hosen, Silbermond, Juli, Die Ärzte.`
        : langCode === 'fr'
          ? `\n11. CRITICAL for French: Songs MUST be sung in French — not English tracks by French artists.`
          : langCode === 'it'
            ? `\n11. CRITICAL for Italian: Songs MUST be sung in Italian. NEVER pick English covers (Beggin' by Måneskin). Prefer Eros Ramazzotti, Tiziano Ferro, Bocelli Italian tracks, Ligabue, Nek.`
            : '';

  const genreGuard = genreNorm === 'any'
    ? `\n12. Genre may vary — still pick mainstream ${languageName} hits.`
    : `\n12. GENRE LOCK: every song MUST be unmistakably "${genreNorm}" (not a different style). Reject cross-genre picks. genre field in JSON MUST be exactly "${genreNorm}".`;

  const systemPrompt = `You are a music curator for ${languageName} language learners.
Pick 5 DIFFERENT globally famous songs sung primarily in ${languageName}${genreNorm === 'any' ? '' : ` in the "${genreNorm}" genre`}.

Difficulty context: ${difficulty} — choose well-known hits learners likely recognize.

STRICT RULES:
1. Every song MUST be sung in ${languageName} — NOT English-only tracks unless the target language IS English.
2. Every song MUST be a real chart hit that exists on Deezer with a 30s preview.
3. Every song MUST have lyrics on LRCLib (pick famous songs only).
4. Use exact official artist and song_title as on Deezer/Spotify.
5. Main artist only — no "feat." in the artist field.
6. NEVER invent songs. NEVER use a vocabulary word as the song title.
7. song_title must NOT be a single rare word — use the real commercial track name.
8. Each song MUST be different from every other song you pick.
9. ${avoidList}
10. Prefer songs like: ${hits || '(famous catalog hits)'}${languageConfusionGuard}${genreGuard}${spotifyArtistsGuard}

Reply with ONLY JSON:
{
  "candidates": [
    {
      "song_title": "Real Song Title",
      "artist": "Artist Name",
      "genre": "${genreNorm === 'any' ? 'pop' : genreNorm}"
    }
  ]
}`;

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await Promise.race([
        createChatCompletion({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `List 5 famous ${languageName}-language ${genreNorm} songs for a word-of-the-day playlist. Songs must be sung in ${languageName}. Return JSON only.` },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1200,
          temperature: 0.3,
          top_p: 0.9,
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            const err = new Error('ai_timeout');
            err.code = 'ai_timeout';
            reject(err);
          }, 35000);
        }),
      ]);

      const raw = response.choices?.[0]?.message?.content;
      const parsed = normalizeDailyWord(parseJsonContent(raw));
      if (!parsed?.length) {
        lastErr = new Error('invalid_ai_daily_word_response');
        continue;
      }
      // Catalog genre is the source of truth — never stamp the user's preference onto
      // whatever the model returned (that made every AI pick look "on style").
      const verified = verifiedGenreIndex(langCode);
      const kept = parsed
        .filter((c) => c.song_title && c.artist)
        .map((c) => {
          const key = songCandidateKey(c);
          const known = verified.get(key);
          if (known) {
            if (genreNorm !== 'any' && known !== genreNorm) return null;
            return { ...c, genre: known };
          }
          const selfGenre = normalizeCandidateGenre(c.genre);
          if (genreNorm === 'any') {
            return { ...c, genre: selfGenre || 'pop' };
          }
          // Untagged or mismatched AI genre → reject (do not forge).
          if (!selfGenre || selfGenre !== genreNorm) return null;
          return { ...c, genre: selfGenre };
        })
        .filter(Boolean);
      if (!kept.length) {
        lastErr = new Error('invalid_ai_daily_word_response');
        continue;
      }
      return kept;
    } catch (err) {
      if (isRateLimitError(err)) {
        const e = new Error('ai_rate_limit');
        e.code = 'ai_rate_limit';
        throw e;
      }
      lastErr = err;
    }
  }

  throw lastErr || new Error('invalid_ai_daily_word_response');
}

function sanitizeGloss(word, gloss, line = null) {
  if (!gloss) return { translation: null, part_of_speech: null, pronunciation: null };
  let raw = String(gloss.translation || "").trim();
  // Models sometimes append a language tag: "hope EN", "amour (FR)".
  raw = raw
    .replace(/\s*[\(\[]?\b(en|es|fr|de|it|pt|eng|spa|fre|ger|ita|por)\b[\)\]]?\s*$/i, "")
    .replace(/\s*[-–—]\s*(english|spanish|french|german|italian|portuguese)\s*$/i, "")
    .trim();
  const sameWord = raw.toLowerCase() === String(word || "").toLowerCase();
  let translation = raw && !sameWord ? raw : null;
  if (translation && translationLooksSuspicious(word, translation, line)) {
    translation = null;
  }
  return {
    translation,
    part_of_speech: gloss.part_of_speech || null,
    pronunciation: gloss.pronunciation || null,
    line_translation: sanitizeLineGloss(gloss.line_translation),
  };
}

function normalizeGlossLemma(word) {
  return String(word || "")
    .normalize("NFC")
    .trim()
    .replace(/^[''`´‘’]+/u, "")
    .replace(/[''`´‘’]+$/gu, "")
    .toLowerCase();
}

/**
 * Heuristic: models often map a whole lyric idiom onto one word
 * (e.g. "brings" in "brings me down" → "hace caer"). Flag for re-check.
 * Also catch "glossed the wrong word from the line" (color → hope when both appear)
 * and encyclopedic / programming junk from dictionary APIs (Genus Lama, Imam, int).
 */
function translationLooksSuspicious(word, translation, line = null) {
  const raw = String(translation || "").trim();
  const w = normalizeGlossLemma(word);
  let t = raw.toLowerCase();
  t = t
    .replace(/\s*[\(\[]?\b(en|es|fr|de|it|pt|eng|spa|fre|ger|ita|por)\b[\)\]]?\s*$/i, "")
    .trim();
  if (!w || !t) return true;
  if (t === w) return true;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length > 4) return true;
  if (/\([^)]+\)/.test(raw) || /\[[^\]]+\]/.test(raw)) return true;
  if (raw.includes(",")) return true;
  if (/\b(genus|organism|wikipedia|cableway|ropeway|integer|imam|lama|señalización|senalizacion)\b/i.test(raw)) return true;
  if (/\bvial\b/i.test(raw)) return true;
  if (/\b[a-z]\.\s+\S/i.test(raw) || (/[.]/.test(raw) && raw.length < 12 && /\./.test(raw))) return true;
  if (/^(int|float|bool|boolean|null|void|undefined|string|fis)$/i.test(t)) return true;
  // ALL-CAPS multi-word dumps ("THEY WILL SAY") and short code-like tokens ("FIs", "INT").
  if (/^[A-Z]{2,}(\s+[A-Z]+){1,}$/.test(raw)) return true;
  if (/^[A-Z]{2,4}$/.test(raw) && raw.length <= 4) return true;
  const titleCase = raw[0] === raw[0].toUpperCase() && raw.slice(1) === raw.slice(1).toLowerCase();
  const allLower = raw === raw.toLowerCase();
  const allUpper = raw === raw.toUpperCase();
  if (raw.length <= 4 && /[A-Z]/.test(raw) && !titleCase && !allUpper) return true;
  if (!allLower && !titleCase && !allUpper && /[A-Z]/.test(raw) && tokens.length === 1 && raw.length <= 4) {
    return true;
  }
  // Calques of "makes/does X" for verbs that are not make/do
  if (
    /^(hace|hacer|makes?|making|does|doing)\b/.test(t) &&
    !/^(make|makes|making|made|do|does|doing|did|hacer|hace|hago|hacen)$/.test(w)
  ) {
    return true;
  }
  // If the translation is another distinct token already in the lyric, the model
  // almost certainly glossed the wrong word (e.g. COLOR → "hope" from the same line).
  if (line) {
    const lineTokens = String(line)
      .toLowerCase()
      .split(/[^\p{L}\p{N}']+/u)
      .filter(Boolean)
      .map((tok) => normalizeGlossLemma(tok));
    if (lineTokens.includes(w) && lineTokens.includes(t) && t !== w) {
      return true;
    }
  }
  return false;
}

/** Small high-confidence glosses for frequent learner words (target → native). */
const COMMON_GLOSS_TABLE = {
  "es|en": {
    color: "colour",
    amor: "love",
    corazon: "heart",
    corazón: "heart",
    vida: "life",
    tiempo: "time",
    noche: "night",
    dia: "day",
    día: "day",
    luz: "light",
    fuego: "fire",
    esperanza: "hope",
    pendiente: "earring",
    llamas: "you call",
    llama: "calls",
    iman: "magnet",
    imán: "magnet",
    entero: "whole",
    vaiven: "sway",
    vaivén: "sway",
    diran: "they will say",
    dirán: "they will say",
    chantaje: "blackmail",
    llora: "cries",
    quiero: "I want",
    cómo: "how",
    dame: "give me",
    despues: "after",
    después: "after",
    solté: "I let go",
    solte: "I let go",
    quedamo: "we stay",
    quedamos: "we stay",
  },
  "en|es": {
    color: "color",
    colour: "color",
    love: "amor",
    heart: "corazón",
    hope: "esperanza",
    night: "noche",
    light: "luz",
    alive: "vivo",
    shake: "agitar",
    going: "yendo",
    caring: "cariñoso",
    sugar: "azúcar",
    cause: "porque",
    enough: "suficiente",
    leave: "irme",
    lead: "guía",
    follow: "seguir",
    ruler: "gobernante",
    please: "por favor",
    think: "pensar",
    levitating: "levitando",
    before: "antes",
    friend: "amigo",
    swing: "balancear",
    body: "cuerpo",
    maybe: "tal vez",
    across: "a través",
    things: "cosas",
    late: "tarde",
    remind: "recordar",
    gets: "se pone",
    get: "se pone",
    crazy: "loco",
    magnet: "imán",
    signs: "señales",
    sign: "señal",
    judge: "juzgar",
    touch: "toque",
    empty: "vacío",
    kind: "tipo",
    shall: "vas a",
    have: "tener",
  },
  "fr|en": {
    amour: "love",
    coeur: "heart",
    cœur: "heart",
    nuit: "night",
    jour: "day",
    espoir: "hope",
    couleur: "colour",
  },
  "de|en": {
    liebe: "love",
    herz: "heart",
    nacht: "night",
    hoffnung: "hope",
    farbe: "colour",
  },
  "it|en": {
    amore: "love",
    cuore: "heart",
    notte: "night",
    speranza: "hope",
    colore: "colour",
  },
  "pt|en": {
    amor: "love",
    coracao: "heart",
    coração: "heart",
    noite: "night",
    esperanca: "hope",
    esperança: "hope",
    cor: "colour",
  },
};

function lyricSenseLookup(word, fromLang, toLang, line) {
  const lemma = normalizeGlossLemma(word);
  const L = String(line || "").toLowerCase();
  const from = String(fromLang || "").toLowerCase();
  const to = String(toLang || "").toLowerCase();
  if (!lemma || from === to) return null;
  if (from === "en" && to === "es") {
    if (lemma === "late") return "tarde";
    if ((lemma === "get" || lemma === "gets") && /\bhard\b/.test(L)) return "se pone";
    if (lemma === "gets" || lemma === "get") return "se pone";
    if (lemma === "have" && /\bhave to\b/.test(L)) return "tener que";
    if (lemma === "judge" && /\b(judge me|to judge|judge)\b/.test(L)) return "juzgar";
    if (lemma === "touch") return "toque";
    if (lemma === "signs" || lemma === "sign") return "señales";
    if (lemma === "shall") return "vas a";
    if (lemma === "magnet") return "imán";
  }
  return null;
}

function sanitizeLineGloss(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (/MYMEMORY WARNING|genus|organism|wikipedia/i.test(raw)) return null;
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length > 16) return tokens.slice(0, 16).join(" ");
  return raw;
}

function commonGlossLookup(word, fromLang, toLang, line = null) {
  const keyed = lyricSenseLookup(word, fromLang, toLang, line);
  if (keyed) return keyed;
  const key = `${String(fromLang || "").toLowerCase()}|${String(toLang || "").toLowerCase()}`;
  const table = COMMON_GLOSS_TABLE[key];
  if (!table) return null;
  const lemma = normalizeGlossLemma(word);
  if (!lemma) return null;
  return table[lemma] || table[String(word || "").trim().toLowerCase()] || null;
}

function stripDictLangSuffix(text) {
  return String(text || "")
    .replace(/\s*[\(\[]?\b(en|es|fr|de|it|pt)\b[\)\]]?\s*$/i, "")
    .trim();
}

const MYMEMORY_MIN_MATCH = 0.75;

function pickDictionaryCandidate(word, line, candidates) {
  const lemma = normalizeGlossLemma(word);
  const ranked = [...candidates].sort((a, b) => (b.match || 0) - (a.match || 0));
  for (const c of ranked) {
    const translated = stripDictLangSuffix(c.text);
    if (!translated) continue;
    if (/MYMEMORY WARNING/i.test(translated)) continue;
    if (normalizeGlossLemma(translated) === lemma) continue;
    const match = Number(c.match);
    const hasMatch = Number.isFinite(match) && match > 0;
    if (hasMatch && match < MYMEMORY_MIN_MATCH) continue;
    if (translationLooksSuspicious(word, translated, line)) continue;
    if (!hasMatch && translated.split(/\s+/).length > 2) continue;
    return translated;
  }
  return null;
}

/**
 * Deterministic single-word gloss via curated table, then high-confidence MyMemory.
 * Used when AI returns null/suspicious translations so learners never see "COLOR → hope"
 * or encyclopedic junk ("llamas" → "Genus Lama").
 */
async function dictionaryGlossFallback(word, fromLang, toLang, fetchImpl = fetch, line = null) {
  const text = String(word || "").trim();
  const from = String(fromLang || "").toLowerCase();
  const to = String(toLang || "").toLowerCase();
  if (!text || !from || !to || from === to) return null;

  const common = commonGlossLookup(text, from, to, line);
  if (common) return common;

  try {
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
      `&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const candidates = [];
    const primary = String(data?.responseData?.translatedText || "").trim();
    if (primary) {
      candidates.push({ text: primary, match: Number(data?.responseData?.match || 0) });
    }
    if (Array.isArray(data?.matches)) {
      for (const m of data.matches) {
        const mt = String(m?.translation || "").trim();
        if (mt) candidates.push({ text: mt, match: Number(m?.match || m?.quality || 0) });
      }
    }
    return pickDictionaryCandidate(text, line, candidates);
  } catch {
    return null;
  }
}

async function refineGlosses(items, glosses, languageName, nativeLanguageName, { fast = false } = {}) {
  if (!items?.length) return glosses || [];

  const pairs = items.map((item, i) => ({
    word: item.word,
    line: item.line,
    translation: glosses?.[i]?.translation || null,
    part_of_speech: glosses?.[i]?.part_of_speech || null,
    pronunciation: glosses?.[i]?.pronunciation || null,
  }));

  const needsCheck = pairs.some((p) => translationLooksSuspicious(p.word, p.translation, p.line));
  // Never spend an AI round-trip when glosses already look fine (keeps Next Word snappy).
  if (!needsCheck) return glosses;

  const refinePrompt = `You are checking vocabulary glosses for language learners.
For each item, the translation MUST be a short, accurate ${nativeLanguageName} meaning of ONLY the single ${languageName} word — as that word is used in the lyric line.
Do NOT translate the whole line, idiom, or neighboring words onto this word.
Do NOT return a translation of a different word that also appears in the line.

Wrong example: word "brings", line "…brings me down…", translation "hace caer" or "derriba" → FIX to "trae" (or "lleva").
Wrong example: word "pressure", line "under pressure", translation "bajo presión" as if the word meant the whole phrase → FIX to "presión".
Wrong example: word "color", line "…color…hope…", translation "hope" → FIX to the real meaning of "color" (or leave empty if cognate).

Keep translations to 1–3 everyday words in ${nativeLanguageName}. Never repeat the ${languageName} word. Never append a language code.
Keep or improve part_of_speech and pronunciation (IPA or readable phonetic for the ${languageName} word).

Items: ${JSON.stringify(pairs)}

Reply JSON only: { "words": [ { "word": "...", "translation": "...", "part_of_speech": "...", "pronunciation": "...", "corrected": true|false } ] }`;

  try {
    const response = await (fast
      ? createFastChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You verify ${languageName}→${nativeLanguageName} learner glosses. Fix wrong word senses. JSON only.`,
          },
          { role: 'user', content: refinePrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 768,
        temperature: 0.1,
      }, 12000)
      : createChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You verify ${languageName}→${nativeLanguageName} learner glosses. Fix wrong word senses. JSON only.`,
          },
          { role: 'user', content: refinePrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2048,
        temperature: 0.1,
      }));

    const raw = parseJsonContent(response.choices?.[0]?.message?.content);
    const list = raw?.words || raw?.items || [];
    const byWord = new Map(list.map((w) => [String(w.word || '').toLowerCase(), w]));

    return pairs.map((pair, idx) => {
      const hit = byWord.get(String(pair.word || '').toLowerCase());
      const ordered = list[idx];
      const candidate = hit || (
        ordered && String(ordered.word || '').toLowerCase() === String(pair.word || '').toLowerCase()
          ? ordered
          : null
      );
      const merged = sanitizeGloss(pair.word, {
        translation: candidate?.translation ?? pair.translation,
        part_of_speech: candidate?.part_of_speech ?? pair.part_of_speech,
        pronunciation: candidate?.pronunciation ?? pair.pronunciation,
      }, pair.line);
      if (!merged.translation && pair.translation
          && !translationLooksSuspicious(pair.word, pair.translation, pair.line)) {
        return sanitizeGloss(pair.word, pair, pair.line);
      }
      return merged;
    });
  } catch (err) {
    console.warn(`daily word gloss refine failed: ${err.message || err}`);
    return glosses || pairs.map((p) => sanitizeGloss(p.word, p, p.line));
  }
}

async function glossDailyWords(items, languageName, {
  fast = false,
  nativeLanguageName = "English",
  refine = false,
  fromLang = null,
  toLang = null,
  fetchImpl = fetch,
} = {}) {
  if (!items?.length) return [];

  const glossUserPrompt = `For each item, translate ONLY the single target "word" into ${nativeLanguageName}.
Use the lyric "line" only to pick the correct dictionary sense of that word — never gloss the whole phrase or idiom as if it were the word.

Hard rules:
1. Translation language: ${nativeLanguageName} only.
2. Length: 1–3 short everyday words (prefer one word when possible).
3. Never repeat the ${languageName} word as the translation.
4. Do not invent meanings from surrounding words (WRONG: "brings" → "hace caer" because the line says "brings me down"; RIGHT: "trae").
5. Ambiguous words must match the line (e.g. Spanish "pendiente" in "Un pendiente de oro" → "earring", not "pending").
6. Never translate a DIFFERENT word from the same line (WRONG: word "color", line has "hope", translation "hope").
7. Never append a language code (WRONG: "hope EN").
8. Also give part_of_speech and pronunciation (IPA or readable phonetic for how to say the ${languageName} word).
9. Also give line_translation: a short natural ${nativeLanguageName} rendering of the lyric line (how a learner should understand that sentence), 4–14 everyday words. Use the line's meaning, not a dictionary first-hit.

Items: ${JSON.stringify(items)}

Reply: { "words": [ { "word": "...", "translation": "...", "part_of_speech": "noun|verb|...", "pronunciation": "/.../" } ] }`;

  const runGloss = async () => {
    const response = await (fast
      ? createFastChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You translate single ${languageName} words into ${nativeLanguageName} for learners. Use lyric context only to disambiguate sense — never paraphrase the whole line or borrow a neighbor word's meaning. Return JSON only.`,
          },
          {
            role: 'user',
            content: glossUserPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512,
        temperature: 0.15,
      }, 10000)
      : createChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You translate single ${languageName} words into ${nativeLanguageName} for learners. Use lyric context only to disambiguate sense — never paraphrase the whole line or borrow a neighbor word's meaning. Return JSON only.`,
          },
          {
            role: 'user',
            content: glossUserPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2048,
        temperature: 0.15,
      }));

    const raw = parseJsonContent(response.choices?.[0]?.message?.content);
    const list = Array.isArray(raw?.words) ? raw.words
      : Array.isArray(raw?.items) ? raw.items
        : [];
    const byWord = new Map(
      list
        .filter((w) => w && w.word)
        .map((w) => [String(w.word || '').toLowerCase(), w])
    );

    let glosses = items.map((item, i) => {
      const key = String(item.word || '').toLowerCase();
      const byKey = byWord.get(key);
      const ordered = list[i];
      let hit = byKey;
      if (!hit && ordered) {
        const orderedWord = String(ordered.word || '').toLowerCase();
        if (!orderedWord || orderedWord === key) hit = ordered;
      }
      return sanitizeGloss(item.word, {
        translation: hit?.translation,
        part_of_speech: hit?.part_of_speech,
        pronunciation: hit?.pronunciation,
        line_translation: hit?.line_translation,
      }, item.line);
    });

    if (refine) {
      glosses = await refineGlosses(items, glosses, languageName, nativeLanguageName, { fast });
    }

    if (fromLang && toLang) {
      glosses = await Promise.all(glosses.map(async (g, i) => {
        const item = items[i];
        const common = commonGlossLookup(item.word, fromLang, toLang, item.line);
        // Curated table beats a conflicting AI gloss (e.g. color → "hope").
        if (common && g?.translation) {
          const a = common.toLowerCase();
          const b = String(g.translation).toLowerCase();
          if (a !== b && !a.includes(b) && !b.includes(a)) {
            return sanitizeGloss(item.word, {
              translation: common,
              part_of_speech: g.part_of_speech,
              pronunciation: g.pronunciation,
            }, item.line);
          }
        }
        const bad = !g?.translation
          || translationLooksSuspicious(item.word, g.translation, item.line);
        if (!bad) return g;
        const fb = common || await dictionaryGlossFallback(item.word, fromLang, toLang, fetchImpl, item.line);
        if (!fb) return { ...g, translation: null };
        return sanitizeGloss(item.word, {
          translation: fb,
          part_of_speech: g?.part_of_speech,
          pronunciation: g?.pronunciation,
        }, item.line);
      }));
    }

    return glosses;
  };

  if (!fast) return runGloss();

  try {
    return await runGloss();
  } catch (err) {
    console.warn(`daily word gloss fallback: ${err.message || err}`);
    if (fromLang && toLang) {
      return Promise.all(items.map(async (item) => {
        const fb = await dictionaryGlossFallback(item.word, fromLang, toLang, fetchImpl, item.line);
        return sanitizeGloss(item.word, fb ? { translation: fb } : null, item.line);
      }));
    }
    return items.map((item) => sanitizeGloss(item.word, null, item.line));
  }
}

module.exports = {
  extractVocabulary,
  generateDailyWord,
  generateDailyWordSongs,
  getCuratedSongCandidates,
  getVerifiedSongCandidates,
  normalizeGenre,
  normalizeCandidateGenre,
  genresCompatible,
  songCandidateKey,
  verifiedGenreIndex,
  glossDailyWords,
  refineGlosses,
  sanitizeGloss,
  translationLooksSuspicious,
  dictionaryGlossFallback,
  commonGlossLookup,
  lyricSenseLookup,
  normalizeGlossLemma,
  createChatCompletion,
  createFastChatCompletion,
  AVAILABLE_MODELS,
  OPENROUTER_MODELS,
  openai,
  openrouter,
};
