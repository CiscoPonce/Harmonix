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
      'moonshotai/kimi-k2.6',
      'meta/llama-3.3-70b-instruct',
      'meta/llama-3.1-8b-instruct',
      'mistralai/mistral-medium-3.5-128b',
      'minimaxai/minimax-m3',
      'stepfun-ai/step-3.7-flash',
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
1. Each target_word MUST appear verbatim (same spelling) in its matching song lyrics.
2. Choose globally known hit songs that exist on Deezer with a 30s preview. Use exact official artist and song_title as listed on Deezer (main artist only, no "feat." in artist field).
3. Every candidate MUST match BOTH the CEFR level (${cefrLevel}) AND difficulty (${diff}).
4. Return realistic song_title and artist names only — no made-up songs.
5. Each candidate MUST include cefr_level (A1-C2) and difficulty (easy|medium|hard) matching the rules above.
6. ${avoidList}

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

module.exports = {
  extractVocabulary,
  generateDailyWord,
  createChatCompletion,
  AVAILABLE_MODELS,
  openai,
};
