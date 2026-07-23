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
      // Ranked 2026-07-22 free-model bench (gloss "brings"→"trae" + song JSON):
      // llama-3.1-8b won on quality+latency; kimi-k2.6 currently 404 on NIM.
      'meta/llama-3.1-8b-instruct',
      'minimaxai/minimax-m3',
      'qwen/qwen3-next-80b-a3b-instruct',
      'meta/llama-3.3-70b-instruct',
      'stepfun-ai/step-3.7-flash',
      'nvidia/nvidia-nemotron-nano-9b-v2',
    ];

const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS
  || 'nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-26b-a4b-it:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const FAST_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'stepfun-ai/step-3.7-flash',
  'nvidia/nvidia-nemotron-nano-9b-v2',
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

function isRetryableError(err) {
  return isRateLimitError(err) || err?.status === 404 || (err?.status >= 500 && err?.status < 600);
}

function buildModelAttempts(primaryModel, { fast = false } = {}) {
  const nimClient = fast ? openaiFast : openai;
  const nimChain = fast
    ? [...new Set([primaryModel, ...FAST_MODELS])]
    : [primaryModel, ...AVAILABLE_MODELS.filter((m) => m !== primaryModel)];

  const attempts = [];
  const skipNim = isNimInCooldown();

  // User-facing fast path: try working OpenRouter free models first (more reliable
  // latency on VPS), then short-timeout NIM. Full song generation keeps NIM first.
  if (fast) {
    if (openrouter) {
      for (const model of OPENROUTER_MODELS) {
        attempts.push({ client: openrouter, provider: 'openrouter', model });
      }
    }
    if (!skipNim) {
      for (const model of nimChain) {
        attempts.push({ client: nimClient, provider: 'nvidia', model });
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
      if (provider === 'nvidia' && isRateLimitError(err)) markNimRateLimited();
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
  const g = String(genre || 'pop').toLowerCase();
  if (g === 'hip-hop' || g === 'hiphop') return 'pop';
  return g;
}

function getVerifiedSongCandidates(languageCode, genre) {
  const langCode = normalizeLanguageCode(languageCode);
  const list = VERIFIED_SONGS[langCode] || [];
  if (!list.length) return getCuratedSongCandidates(languageCode, genre);
  const g = normalizeGenre(genre);
  const matched = list.filter((s) => s.genre === g || g === 'any');
  return matched.length >= 5 ? matched : list;
}

const GENRE_HIT_EXAMPLES = {
  es: {
    reggaeton: 'Gasolina (Daddy Yankee), Despacito (Luis Fonsi), Dákiti (Bad Bunny), Tití Me Preguntó (Bad Bunny), Con Calma (Daddy Yankee), Me Porto Bonito (Bad Bunny), Yo Perreo Sola (Bad Bunny), Pepas (Farruko), Danza Kuduro (Don Omar), Taki Taki (DJ Snake), Mi Gente (J Balvin), Tusa (Karol G), El Perdón (Nicky Jam), Caramelo (Ozuna)',
    pop: 'Despacito (Luis Fonsi), Bailando (Enrique Iglesias), Vivir Mi Vida (Marc Anthony), La Bicicleta (Carlos Vives), Propuesta Indecente (Romeo Santos), Felices los 4 (Maluma), Hawái (Maluma), Échame La Culpa (Luis Fonsi), Color Esperanza (Diego Torres), Sofía (Alvaro Soler), Fuiste Tú (Ricardo Arjona), Creo En Ti (Reik)',
    rock: 'A Dios le Pido (Juanes), La Camisa Negra (Juanes), En El Muelle de San Blas (Maná), Clavado en Un Bar (Maná), Rayando el Sol (Maná)',
    any: 'Despacito (Luis Fonsi), Gasolina (Daddy Yankee), Vivir Mi Vida (Marc Anthony), Bailando (Enrique Iglesias), La Bicicleta (Carlos Vives), Propuesta Indecente (Romeo Santos)',
  },
  en: {
    pop: 'Bad Guy (Billie Eilish), Shallow (Lady Gaga), Rolling in the Deep (Adele), Heat Waves (Glass Animals), Someone You Loved (Lewis Capaldi), Hello (Adele), Stay With Me (Sam Smith)',
    rock: 'Mr. Brightside (The Killers), Demons (Imagine Dragons), Radioactive (Imagine Dragons), Yellow (Coldplay), Believer (Imagine Dragons)',
    any: 'Bad Guy (Billie Eilish), Rolling in the Deep (Adele), Heat Waves (Glass Animals), Mr. Brightside (The Killers)',
  },
  fr: {
    pop: 'Formidable (Stromae), On écrit sur les murs (Kids United), Tourner dans le vide (Indila), Je veux (Zaz), Avant nous (Soprano), Dernière Danse (Indila), Papaoutai (Stromae)',
    rock: 'Mistral gagnant (Renaud), Comme des enfants (Cœur de pirate)',
    any: 'Formidable (Stromae), Je veux (Zaz), Mistral gagnant (Renaud), Tourner dans le vide (Indila)',
  },
  de: {
    pop: 'Atemlos durch die Nacht (Helene Fischer), Männer (Herbert Grönemeyer), 99 Luftballons (Nena), Auf uns (Andreas Bourani), Das Beste (Silbermond), Perfekte Welle (Juli)',
    rock: 'Du hast (Rammstein), Durch den Monsun (Tokio Hotel), Engel (Rammstein), Tage wie diese (Die Toten Hosen), Nur ein Wort (Wir sind Helden)',
    any: 'Atemlos durch die Nacht (Helene Fischer), Männer (Herbert Grönemeyer), 99 Luftballons (Nena), Du hast (Rammstein), Das Beste (Silbermond)',
  },
  pt: {
    pop: 'Ai Se Eu Te Pego (Michel Teló), Envolver (Anitta), Garota de Ipanema (Tom Jobim), Balada (Gusttavo Lima), Olha a Explosão (MC Kevinho), Evidências (Chitãozinho & Xororó), Show das Poderosas (Anitta), Infiel (Marília Mendonça)',
    rock: 'Eduardo e Mônica (Legião Urbana)',
    any: 'Ai Se Eu Te Pego (Michel Teló), Envolver (Anitta), Garota de Ipanema (Tom Jobim), Balada (Gusttavo Lima), Olha a Explosão (MC Kevinho)',
  },
  it: {
    pop: 'Più bella cosa (Eros Ramazzotti), Sere nere (Tiziano Ferro), Guerriero (Marco Mengoni), Con te partirò (Andrea Bocelli), Sarà perché ti amo (Ricchi e Poveri), Gloria (Umberto Tozzi), Laura non c\'è (Nek)',
    rock: 'Zitti e buoni (Måneskin), Certe Notti (Ligabue), Bello e impossibile (Gianna Nannini)',
    any: 'Zitti e buoni (Måneskin), Più bella cosa (Eros Ramazzotti), Sere nere (Tiziano Ferro), Guerriero (Marco Mengoni)',
  },
};

function normalizeLanguageCode(code) {
  return String(code || 'es').toLowerCase();
}

function genreExamplesForLanguage(languageCode, genre) {
  const byLang = GENRE_HIT_EXAMPLES[normalizeLanguageCode(languageCode)] || GENRE_HIT_EXAMPLES.es;
  const g = normalizeGenre(genre);
  return byLang[g] || byLang.any;
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
  const hits = genreExamplesForLanguage(langCode, genre);
  return parseCuratedSongs(hits, genre || 'pop');
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

async function generateDailyWordSongs({ languageName, languageCode, genre, difficulty, avoidSongs = [] }) {
  const langCode = normalizeLanguageCode(languageCode);
  const hits = genreExamplesForLanguage(langCode, genre);
  const avoidList = avoidSongs.length
    ? `NEVER pick these already-used songs: ${avoidSongs.map((k) => k.replace("|", " - ")).join("; ")}.`
    : "";

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

  const systemPrompt = `You are a music curator for ${languageName} language learners.
Pick 5 DIFFERENT globally famous songs sung primarily in ${languageName} in the "${genre}" genre.

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
10. Prefer songs like: ${hits}${languageConfusionGuard}

Reply with ONLY JSON:
{
  "candidates": [
    {
      "song_title": "Real Song Title",
      "artist": "Artist Name",
      "genre": "${genre}"
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
            { role: 'user', content: `List 5 famous ${languageName}-language ${genre} songs for a word-of-the-day playlist. Songs must be sung in ${languageName}. Return JSON only.` },
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
      return parsed.filter((c) => c.song_title && c.artist);
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

function sanitizeGloss(word, gloss) {
  if (!gloss) return { translation: null, part_of_speech: null, pronunciation: null };
  const raw = String(gloss.translation || "").trim();
  const sameWord = raw.toLowerCase() === String(word || "").toLowerCase();
  return {
    translation: raw && !sameWord ? raw : null,
    part_of_speech: gloss.part_of_speech || null,
    pronunciation: gloss.pronunciation || null,
  };
}

/**
 * Heuristic: models often map a whole lyric idiom onto one word
 * (e.g. "brings" in "brings me down" → "hace caer"). Flag for re-check.
 */
function translationLooksSuspicious(word, translation) {
  const w = String(word || "").trim().toLowerCase();
  const t = String(translation || "").trim().toLowerCase();
  if (!w || !t) return true;
  if (t === w) return true;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length > 4) return true;
  // Calques of "makes/does X" for verbs that are not make/do
  if (
    /^(hace|hacer|makes?|making|does|doing)\b/.test(t) &&
    !/^(make|makes|making|made|do|does|doing|did|hacer|hace|hago|hacen)$/.test(w)
  ) {
    return true;
  }
  return false;
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

  const needsCheck = pairs.some((p) => translationLooksSuspicious(p.word, p.translation));
  // Never spend an AI round-trip when glosses already look fine (keeps Next Word snappy).
  if (!needsCheck) return glosses;

  const refinePrompt = `You are checking vocabulary glosses for language learners.
For each item, the translation MUST be a short, accurate ${nativeLanguageName} meaning of ONLY the single ${languageName} word — as that word is used in the lyric line.
Do NOT translate the whole line, idiom, or neighboring words onto this word.

Wrong example: word "brings", line "…brings me down…", translation "hace caer" or "derriba" → FIX to "trae" (or "lleva").
Wrong example: word "pressure", line "under pressure", translation "bajo presión" as if the word meant the whole phrase → FIX to "presión".

Keep translations to 1–3 everyday words in ${nativeLanguageName}. Never repeat the ${languageName} word.
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

    return pairs.map((pair) => {
      const hit = byWord.get(String(pair.word || '').toLowerCase());
      const merged = sanitizeGloss(pair.word, {
        translation: hit?.translation ?? pair.translation,
        part_of_speech: hit?.part_of_speech ?? pair.part_of_speech,
        pronunciation: hit?.pronunciation ?? pair.pronunciation,
      });
      // Prefer refined translation unless sanitizer wiped it
      if (!merged.translation && pair.translation) {
        return sanitizeGloss(pair.word, pair);
      }
      return merged;
    });
  } catch (err) {
    console.warn(`daily word gloss refine failed: ${err.message || err}`);
    return glosses || pairs.map((p) => sanitizeGloss(p.word, p));
  }
}

async function glossDailyWords(items, languageName, { fast = false, nativeLanguageName = "English", refine = false } = {}) {
  if (!items?.length) return [];

  const glossUserPrompt = `For each item, translate ONLY the single target "word" into ${nativeLanguageName}.
Use the lyric "line" only to pick the correct dictionary sense of that word — never gloss the whole phrase or idiom as if it were the word.

Hard rules:
1. Translation language: ${nativeLanguageName} only.
2. Length: 1–3 short everyday words (prefer one word when possible).
3. Never repeat the ${languageName} word as the translation.
4. Do not invent meanings from surrounding words (WRONG: "brings" → "hace caer" because the line says "brings me down"; RIGHT: "trae").
5. Ambiguous words must match the line (e.g. Spanish "pendiente" in "Un pendiente de oro" → "earring", not "pending").
6. Also give part_of_speech and pronunciation (IPA or readable phonetic for how to say the ${languageName} word).

Items: ${JSON.stringify(items)}

Reply: { "words": [ { "word": "...", "translation": "...", "part_of_speech": "noun|verb|...", "pronunciation": "/.../" } ] }`;

  const runGloss = async () => {
    const response = await (fast
      ? createFastChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You translate single ${languageName} words into ${nativeLanguageName} for learners. Use lyric context only to disambiguate sense — never paraphrase the whole line. Return JSON only.`,
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
            content: `You translate single ${languageName} words into ${nativeLanguageName} for learners. Use lyric context only to disambiguate sense — never paraphrase the whole line. Return JSON only.`,
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
    const list = raw?.words || raw?.items || [];
    const byWord = new Map(list.map((w) => [String(w.word || '').toLowerCase(), w]));

    const glosses = items.map((item) => {
      const hit = byWord.get(String(item.word || '').toLowerCase());
      return sanitizeGloss(item.word, {
        translation: hit?.translation,
        part_of_speech: hit?.part_of_speech,
        pronunciation: hit?.pronunciation,
      });
    });

    if (!refine) return glosses;
    return refineGlosses(items, glosses, languageName, nativeLanguageName, { fast });
  };

  if (!fast) return runGloss();

  try {
    return await runGloss();
  } catch (err) {
    console.warn(`daily word gloss fallback: ${err.message || err}`);
    return items.map((item) => sanitizeGloss(item.word, null));
  }
}

module.exports = {
  extractVocabulary,
  generateDailyWord,
  generateDailyWordSongs,
  getCuratedSongCandidates,
  getVerifiedSongCandidates,
  normalizeGenre,
  glossDailyWords,
  refineGlosses,
  sanitizeGloss,
  translationLooksSuspicious,
  createChatCompletion,
  createFastChatCompletion,
  AVAILABLE_MODELS,
  OPENROUTER_MODELS,
  openai,
  openrouter,
};
