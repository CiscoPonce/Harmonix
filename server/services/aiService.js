const { OpenAI } = require('openai');
const { difficultyRubric, normalizeDifficulty } = require('../constants/difficulty');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: 60000, maxRetries: 0,
});

const openrouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    timeout: 60000,
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
      'moonshotai/kimi-k2.6',
      'stepfun-ai/step-3.7-flash',
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'mistralai/mistral-medium-3.5-128b',
      'minimaxai/minimax-m3',
    ];

const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS
  || 'poolside/laguna-xs-2.1:free,cohere/north-mini-code:free,nvidia/nemotron-3.5-content-safety:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const FAST_MODELS = ['moonshotai/kimi-k2.6', 'stepfun-ai/step-3.7-flash', 'meta/llama-3.1-8b-instruct'];

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
  return isRateLimitError(err) || (err?.status >= 500 && err?.status < 600);
}

function buildModelAttempts(primaryModel, { fast = false } = {}) {
  const nimChain = fast
    ? [...new Set([primaryModel, ...FAST_MODELS, ...AVAILABLE_MODELS])]
    : [primaryModel, ...AVAILABLE_MODELS.filter((m) => m !== primaryModel)];

  const attempts = [];
  const nimPrimary = nimChain[0];
  const skipNim = isNimInCooldown();

  if (nimPrimary && !skipNim) {
    attempts.push({ client: openai, provider: 'nvidia', model: nimPrimary });
  }

  if (openrouter) {
    for (const model of OPENROUTER_MODELS) {
      attempts.push({ client: openrouter, provider: 'openrouter', model });
    }
  }

  if (!skipNim) {
    for (const model of nimChain.slice(1)) {
      attempts.push({ client: openai, provider: 'nvidia', model });
    }
  } else if (!openrouter) {
    for (const model of nimChain.slice(1)) {
      attempts.push({ client: openai, provider: 'nvidia', model });
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
      "translation": "English translation",
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
    { song_title: 'Señorita', artist: 'Shawn Mendes', genre: 'pop' },
    { song_title: 'Taki Taki', artist: 'DJ Snake', genre: 'reggaeton' },
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
};

function getVerifiedSongCandidates(languageCode, genre) {
  const langCode = normalizeLanguageCode(languageCode);
  const list = VERIFIED_SONGS[langCode] || VERIFIED_SONGS.es || [];
  const g = String(genre || 'pop').toLowerCase();
  const matched = list.filter((s) => s.genre === g || g === 'any');
  return matched.length ? matched : list;
}

const GENRE_HIT_EXAMPLES = {
  es: {
    reggaeton: 'Gasolina (Daddy Yankee), Despacito (Luis Fonsi), Dákiti (Bad Bunny), Tití Me Preguntó (Bad Bunny), Con Calma (Daddy Yankee), Me Porto Bonito (Bad Bunny), Yo Perreo Sola (Bad Bunny), Pepas (Farruko), Danza Kuduro (Don Omar), Taki Taki (DJ Snake), Mi Gente (J Balvin), Tusa (Karol G), El Perdón (Nicky Jam), Caramelo (Ozuna)',
    pop: 'Despacito (Luis Fonsi), Bailando (Enrique Iglesias), Vivir Mi Vida (Marc Anthony), La Bicicleta (Carlos Vives), Propuesta Indecente (Romeo Santos), Felices los 4 (Maluma), Hawái (Maluma), Échame La Culpa (Luis Fonsi), Color Esperanza (Diego Torres), Sofía (Alvaro Soler), Fuiste Tú (Ricardo Arjona), Creo En Ti (Reik)',
    rock: 'A Dios le Pido (Juanes), La Camisa Negra (Juanes), En El Muelle de San Blas (Maná), Clavado en Un Bar (Maná), Rayando el Sol (Maná)',
    any: 'Despacito (Luis Fonsi), Gasolina (Daddy Yankee), Vivir Mi Vida (Marc Anthony), Bailando (Enrique Iglesias), La Bicicleta (Carlos Vives), Propuesta Indecente (Romeo Santos)',
  },
  en: {
    pop: 'Shape of You (Ed Sheeran), Blinding Lights (The Weeknd), Someone Like You (Adele), Bad Guy (Billie Eilish)',
    rock: 'Bohemian Rhapsody (Queen), Mr. Brightside (The Killers), Yellow (Coldplay)',
    any: 'Shape of You (Ed Sheeran), Blinding Lights (The Weeknd), Rolling in the Deep (Adele)',
  },
  fr: {
    pop: 'Dernière Danse (Indila), Je veux (Zaz), Papaoutai (Stromae), Tourner dans le vide (Indila)',
    rock: 'Comme des enfants (Cœur de pirate), Mistral gagnant (Renaud)',
    any: 'Dernière Danse (Indila), Papaoutai (Stromae), Je veux (Zaz)',
  },
  de: {
    pop: 'Atemlos (Helene Fischer), 99 Luftballons (Nena), Leider geil (Deichkind)',
    rock: 'Du hast (Rammstein), Wind of Change (Scorpions), Major Tom (Peter Schilling)',
    any: 'Atemlos (Helene Fischer), 99 Luftballons (Nena), Du hast (Rammstein)',
  },
  pt: {
    pop: 'Garota de Ipanema (Tom Jobim), Ai Se Eu Te Pego (Michel Teló), Evidências (Chitãozinho & Xororó)',
    any: 'Garota de Ipanema (Tom Jobim), Ai Se Eu Te Pego (Michel Teló), Evidências (Chitãozinho & Xororó)',
  },
};

function normalizeLanguageCode(code) {
  return String(code || 'es').toLowerCase();
}

function genreExamplesForLanguage(languageCode, genre) {
  const byLang = GENRE_HIT_EXAMPLES[normalizeLanguageCode(languageCode)] || GENRE_HIT_EXAMPLES.es;
  return byLang[String(genre || 'pop').toLowerCase()] || byLang.any;
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

async function createFastChatCompletion(params, timeoutMs = 20000) {
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
10. Prefer songs like: ${hits}

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

async function glossDailyWords(items, languageName, { fast = false, nativeLanguageName = "English" } = {}) {
  if (!items?.length) return [];

  const glossUserPrompt = `For each item, use the lyric "line" to choose the correct sense of the word in that context.
Ambiguous words MUST match how they are used in the line (e.g. Spanish "pendiente" in "Un pendiente de oro" → "earring", not "pending").
The learner's native language is ${nativeLanguageName}. Give translation in ${nativeLanguageName} only (1–3 words, never repeat the ${languageName} word).
Also give part_of_speech and pronunciation (IPA or readable phonetic for how to say the ${languageName} word).
Items: ${JSON.stringify(items)}

Reply: { "words": [ { "word": "...", "translation": "...", "part_of_speech": "noun|verb|...", "pronunciation": "/.../" } ] }`;

  const runGloss = async () => {
    const response = await (fast
      ? createFastChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You translate ${languageName} vocabulary for language learners. Use lyric context to disambiguate. Return JSON only.`,
          },
          {
            role: 'user',
            content: glossUserPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512,
        temperature: 0.2,
      }, 10000)
      : createChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You translate ${languageName} vocabulary for language learners. Use lyric context to disambiguate. Return JSON only.`,
          },
          {
            role: 'user',
            content: glossUserPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2048,
        temperature: 0.2,
      }));

    const raw = parseJsonContent(response.choices?.[0]?.message?.content);
    const list = raw?.words || raw?.items || [];
    const byWord = new Map(list.map((w) => [String(w.word || '').toLowerCase(), w]));

    return items.map((item) => {
      const hit = byWord.get(String(item.word || '').toLowerCase());
      return sanitizeGloss(item.word, {
        translation: hit?.translation,
        part_of_speech: hit?.part_of_speech,
        pronunciation: hit?.pronunciation,
      });
    });
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
  glossDailyWords,
  sanitizeGloss,
  createChatCompletion,
  createFastChatCompletion,
  AVAILABLE_MODELS,
  OPENROUTER_MODELS,
  openai,
  openrouter,
};
