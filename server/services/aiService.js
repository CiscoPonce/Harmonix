const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

/**
 * Extracts 5-10 contextually relevant vocabulary words from lyrics.
 * @param {string} lyricsText - Full lyrics text.
 * @param {string} targetLanguage - Language of the lyrics.
 * @param {string} cefrLevel - User's proficiency level (A1-C2).
 * @returns {Promise<Array>} - Array of extracted vocabulary objects.
 */
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
    model: "meta/llama-3.1-70b-instruct",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Lyrics:\n${lyricsText}` }
    ],
    response_format: { type: "json_object" },
  });

  const content = JSON.parse(response.choices[0].message.content);
  return content.vocabulary;
}

module.exports = {
  extractVocabulary,
  openai // Exported for testing/mocking
};
