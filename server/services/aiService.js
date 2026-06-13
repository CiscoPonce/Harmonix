const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

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

function normalizeDailyWord(content) {
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
    song_title: content.song_title || content.title,
    artist: content.artist,
    genre: content.genre,
  };
}

async function extractVocabulary(lyricsText, targetLanguage, cefrLevel = 'B1') {
  const systemPrompt = `Act as a professional ${targetLanguage} teacher. Your task is to analyze song lyrics and extract 5-10 vocabulary words or phrases.
Target Audience Level: ${cefrLevel}.

Constraints:
1. Words must be essential for understanding the song's themes.
2. Words should be AT or SLIGHTLY ABOVE the user's level.
3. For A1/A2: Avoid idioms, focus on high-frequency concrete nouns and verbs.
4. For B1/B2: Include common phrasal verbs and situational expressions.
5. For C1/C2: Focus on nuanced synonyms, literary terms, and culturally specific metaphors.

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

  const response = await openai.chat.completions.create({
    model: 'stepfun-ai/step-3.7-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Lyrics:\n${lyricsText}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 16384,
    temperature: 1.0,
    top_p: 0.95,
  });

  const content = JSON.parse(response.choices[0].message.content);
  return content.vocabulary;
}

async function generateDailyWord({ languageName, cefrLevel, genre, difficulty, avoidWords = [] }) {
  const avoidList = avoidWords.length
    ? `Avoid these recently used words: ${avoidWords.join(', ')}.`
    : '';

  const systemPrompt = `You are a ${languageName} language teacher. Pick ONE vocabulary word for a learner and pair it with a REAL, well-known ${languageName} song that contains that exact word in its lyrics.

Learner level: ${cefrLevel}
Preferred genre: ${genre}
Difficulty: ${difficulty}

Rules:
1. The target_word MUST appear verbatim (same spelling) in the song lyrics.
2. Choose popular songs likely to have synced lyrics on LRCLib and previews on Deezer.
3. The word should match the learner level (${cefrLevel}).
4. Return realistic song_title and artist names only — no made-up songs.
5. ${avoidList}

Reply with ONLY a JSON object, no markdown or explanation:
{
  "target_word": "word in lyrics",
  "translation": "English translation",
  "part_of_speech": "noun|verb|adjective|...",
  "pronunciation": "optional IPA or phonetic",
  "difficulty": "easy|medium|hard",
  "song_title": "Song Title",
  "artist": "Artist Name",
  "genre": "genre label"
}`;

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'stepfun-ai/step-3.7-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate one ${languageName} word-of-the-day with a matching song.` },
        ],
        max_tokens: 16384,
        temperature: 0.4,
        top_p: 0.95,
      });

      const raw = response.choices?.[0]?.message?.content;
      const parsed = normalizeDailyWord(parseJsonContent(raw));
      if (!parsed?.target_word || !parsed.song_title || !parsed.artist) {
        lastErr = new Error('invalid_ai_daily_word_response');
        continue;
      }
      return parsed;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('invalid_ai_daily_word_response');
}

module.exports = {
  extractVocabulary,
  generateDailyWord,
  openai,
};
