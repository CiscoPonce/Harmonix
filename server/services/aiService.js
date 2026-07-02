const { OpenAI } = require('openai');
const { difficultyRubric, normalizeDifficulty } = require('../constants/difficulty');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: 60000, maxRetries: 0,
});


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const modelsEnv = process.env.NVIDIA_NIM_MODELS || process.env.NVIDIA_NIM_MODEL;
const AVAILABLE_MODELS = modelsEnv
  ? modelsEnv.split(',').map(m => m.trim())
  : [
      'stepfun-ai/step-3.7-flash',
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'mistralai/mistral-medium-3.5-128b',
      'minimaxai/minimax-m3',
      'moonshotai/kimi-k2.6',
    ];

function isRateLimitError(err) {
  return err && (err.status === 429 || String(err.message || '').includes('429'));
}

async function createChatCompletion(params) {
  const primaryModel = params.model || AVAILABLE_MODELS[0];
  const modelsToTry = [primaryModel, ...AVAILABLE_MODELS.filter(m => m !== primaryModel)];

  let lastErr = null;
  for (const model of modelsToTry) {
    try {
      console.log(`Calling ChatCompletion with model: ${model}`);
      return await openai.chat.completions.create({
        ...params,
        model: model,
      });
    } catch (err) {
      lastErr = err;
      console.warn(`Model ${model} failed: ${err.message || err}. Status: ${err.status}`);
      if (isRateLimitError(err) || (err.status >= 500 && err.status < 600)) {
        console.warn(`Attempting fallback to next model...`);
        continue;
      }
      console.warn(`Attempting fallback to next model due to error...`);
      continue;
    }
  }
  throw lastErr || new Error('All chat completion models failed');
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
7. ${avoidList}

Reply with ONLY a JSON object containing a "candidates" array, no markdown or explanation:
{
  "candidates": [
    {
      "target_word": "word in lyrics",
      "translation": "English translation",
      "part_of_speech": "noun|verb|adjective|...",
      "pronunciation": "optional IPA or phonetic",
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

const GENRE_HIT_EXAMPLES = {
  es: {
    reggaeton: 'Gasolina (Daddy Yankee), Despacito (Luis Fonsi), Dákiti (Bad Bunny), Tití Me Preguntó (Bad Bunny), Con Calma (Daddy Yankee), Me Porto Bonito (Bad Bunny)',
    pop: 'Despacito (Luis Fonsi), Bailando (Enrique Iglesias), Vivir Mi Vida (Marc Anthony), La Bicicleta (Carlos Vives)',
    rock: 'Latinoamérica (Calle 13), A Dios le Pido (Juanes), Me Enamora (Juanes)',
    any: 'Despacito (Luis Fonsi), Gasolina (Daddy Yankee), Vivir Mi Vida (Marc Anthony)',
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

function genreExamplesForLanguage(languageCode, genre) {
  const byLang = GENRE_HIT_EXAMPLES[normalizeLanguageCode(languageCode)] || GENRE_HIT_EXAMPLES.es;
  return byLang[String(genre || 'pop').toLowerCase()] || byLang.any;
}

function normalizeLanguageCode(code) {
  return String(code || 'es').toLowerCase();
}

async function generateDailyWordSongs({ languageName, languageCode, genre, difficulty }) {
  const langCode = normalizeLanguageCode(languageCode);
  const hits = genreExamplesForLanguage(langCode, genre);

  const systemPrompt = `You are a music curator for ${languageName} language learners.
Pick 3 DIFFERENT globally famous songs sung primarily in ${languageName} in the "${genre}" genre.

Difficulty context: ${difficulty} — choose well-known hits learners likely recognize.

STRICT RULES:
1. Every song MUST be sung in ${languageName} — NOT English-only tracks unless the target language IS English.
2. Every song MUST be a real chart hit that exists on Deezer with a 30s preview.
3. Every song MUST have lyrics on LRCLib (pick famous songs only).
4. Use exact official artist and song_title as on Deezer/Spotify.
5. Main artist only — no "feat." in the artist field.
6. NEVER invent songs. NEVER use a vocabulary word as the song title.
7. song_title must NOT be a single rare word — use the real commercial track name.
8. Prefer songs like: ${hits}

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
      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `List 3 famous ${languageName}-language ${genre} songs for a word-of-the-day playlist. Songs must be sung in ${languageName}.` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0.3,
        top_p: 0.9,
      });

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

async function glossDailyWords(items, languageName) {
  if (!items?.length) return [];

  const response = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: `You translate ${languageName} vocabulary for learners. Return JSON only.`,
      },
      {
        role: 'user',
        content: `For each item give English translation and part_of_speech.
Items: ${JSON.stringify(items)}

Reply: { "words": [ { "word": "...", "translation": "...", "part_of_speech": "noun|verb|..." } ] }`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
    temperature: 0.2,
  });

  const raw = parseJsonContent(response.choices?.[0]?.message?.content);
  const list = raw?.words || raw?.items || [];
  const byWord = new Map(list.map((w) => [String(w.word || '').toLowerCase(), w]));

  return items.map((item) => {
    const hit = byWord.get(String(item.word || '').toLowerCase());
    return {
      translation: hit?.translation || item.word,
      part_of_speech: hit?.part_of_speech || null,
    };
  });
}

module.exports = {
  extractVocabulary,
  generateDailyWord,
  generateDailyWordSongs,
  glossDailyWords,
  createChatCompletion,
  AVAILABLE_MODELS,
  openai,
};
