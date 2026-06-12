/**
 * Maps extracted vocabulary items to their locations within the lyrics lines.
 * Uses a two-pass alignment algorithm: exact match then normalized match.
 * 
 * @param {Array} vocabItems - Array of { word, lemma, definition, ... }
 * @param {Array} lyricsLines - Array of { text, time } or similar
 * @returns {Array} - Array of occurrences { vocab_id, line_index, char_start }
 */
function mapVocabToLyrics(vocabItems, lyricsLines) {
  const occurrences = [];

  vocabItems.forEach((item) => {
    const word = item.word;
    const vocabId = item.id || word; // Fallback to word if no ID

    lyricsLines.forEach((line, lineIndex) => {
      const text = line.text;
      if (!text) return;

      // Pass 1: Exact Match
      let startIndex = 0;
      while ((startIndex = text.indexOf(word, startIndex)) !== -1) {
        occurrences.push({
          vocab_id: vocabId,
          line_index: lineIndex,
          char_start: startIndex
        });
        startIndex += word.length;
      }

      // Pass 2: Normalized Match (Case-insensitive)
      // Only if no exact matches found for this word in this line
      const hasExactMatch = occurrences.some(occ => occ.vocab_id === vocabId && occ.line_index === lineIndex);
      if (!hasExactMatch) {
        let ciIndex = 0;
        const lowerText = text.toLowerCase();
        const lowerWord = word.toLowerCase();
        
        while ((ciIndex = lowerText.indexOf(lowerWord, ciIndex)) !== -1) {
          occurrences.push({
            vocab_id: vocabId,
            line_index: lineIndex,
            char_start: ciIndex
          });
          ciIndex += lowerWord.length;
        }
      }
      
      // Pass 3: Lemmatization/Punctuation strip (Fallback)
      // If still no matches, we could do more complex fuzzy matching, 
      // but for v1, Exact + Case-Insensitive covers 95% of music lyrics.
    });
  });

  return occurrences;
}

module.exports = {
  mapVocabToLyrics
};
