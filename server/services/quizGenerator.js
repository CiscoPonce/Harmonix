const { nanoid } = require('nanoid');
const db = require('../db');
const { createChatCompletion } = require('./aiService');

function buildQuizPrompt(mappedVocab, unmappedVocab, lyricsLines) {
 const vocabList = [...mappedVocab, ...unmappedVocab]
 .map(v => `"${v.word}" (${v.lemma || v.word})`)
 .join(', ');

 const lyricsSnippet = lyricsLines.slice(0, 40).map(l => l.text).join('\n');

 return `Act as a professional language teacher creating a fill-in-the-blank quiz from song lyrics.
Target Vocabulary: ${vocabList}

Lyrics Snippet:
${lyricsSnippet}

Task: Generate exactly 5 fill-in-the-blank questions.
Rules:
1. Each question must be a coherent sentence from the lyrics with ONE target vocabulary word replaced by "______".
2. Provide exactly 4 multiple choice options (A, B, C, D).
3. Only ONE option is correct (the target word or its exact form from lyrics).
4. Distractors must be plausible but incorrect words from the same language.

Output JSON format:
{
 "questions": [
 {
   "id": "q1",
   "question_text": "Example sentence with ______ blank.",
   "options": ["option_a", "option_b", "option_c", "option_d"],
   "correct_index": 0,
   "vocab_id": "corresponding_vocab_id"
 }
 ]
}`;
}

async function generateQuiz(songId, mappedVocab, unmappedVocab, lyricsLines) {
 const prompt = buildQuizPrompt(mappedVocab, unmappedVocab, lyricsLines);

 async function callOnce() {
  const response = await createChatCompletion({
 messages: [
 { role: 'system', content: 'You are a JSON generator. Always output valid JSON matching the requested schema. Do not include markdown code blocks or explanations.' },
 { role: 'user', content: prompt }
 ],
 response_format: { type: 'json_object' },
 max_tokens: 4096,
 temperature: 0.7,
 });
 return response.choices[0].message.content;
 }

 // Try up to 3 times before giving up to a deterministic local quiz.
 let raw = null;
 let lastErr = null;
 for (let attempt = 1; attempt <= 3; attempt++) {
 try {
 raw = await callOnce();
 if (raw && raw.trim().length > 0) break;
 } catch (err) {
 lastErr = err;
 console.warn(`quiz generator: model attempt ${attempt} threw: ${err.message}`);
 }
 }

 if (!raw) {
 console.warn(`quiz generator: model returned empty/no response (last err: ${lastErr?.message || 'none'}). Falling back to local quiz.`);
 return synthesizeLocalQuiz(mappedVocab, unmappedVocab, lyricsLines);
 }

 let content;
 try {
 content = parseQuizJson(raw);
 } catch (err) {
 console.warn(`quiz generator: parse failed: ${err.message}. Falling back to local quiz.`);
 return synthesizeLocalQuiz(mappedVocab, unmappedVocab, lyricsLines);
 }

 const questions = (content.questions || [])
 .filter(q => q && q.question_text && Array.isArray(q.options) && q.options.length >= 4)
 .map(q => ({
 ...q,
 id: q.id || `q-${nanoid(8)}`,
 vocab_id: resolveVocabId(q.vocab_id, mappedVocab, unmappedVocab),
 }));

 if (questions.length < 3) {
 // Synthesize the rest if the model under-delivered.
 const local = synthesizeLocalQuiz(mappedVocab, unmappedVocab, lyricsLines).questions;
 const merged = [...questions, ...local].slice(0, 5);
 return { songId, questions: merged, generated_at: new Date().toISOString() };
 }

 return {
 songId,
 questions: questions.slice(0, 5),
 generated_at: new Date().toISOString()
 };
}

// The AI model emits the WORD or LEMMA (sometimes with underscored
// spaces, sometimes with various casings/accent forms) in its response,
// not the canonical nanoid we use as primary key. Resolve it back to an
// existing nanoid by matching against the vocab list we passed in. If we
// can't match, leave the value alone — the route can fall back to
// lemma-based lookup.
function resolveVocabId(aiValue, mappedVocab, unmappedVocab) {
 if (aiValue === null || aiValue === undefined) return aiValue;
 if (typeof aiValue !== 'string') return aiValue;
 const all = [...(mappedVocab || []), ...(unmappedVocab || [])];
 const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_]+/g, '').replace(/[.,;:!?]/g, '').trim();
 const aiNorm = norm(aiValue);
 if (!aiNorm) return aiValue;
 for (const item of all) {
 if (!item || !item.vocab_id) continue;
 if (item.vocab_id === aiValue) return item.vocab_id;
 if (norm(item.word) === aiNorm || norm(item.lemma) === aiNorm) return item.vocab_id;
 }
 return aiValue;
}

// Deterministic local fill-in-the-blank fallback used when the model returns
// empty/malformed JSON. Quality won't match the model but keeps the user
// moving instead of crashing the /start endpoint.
function synthesizeLocalQuiz(songId, mappedVocab, unmappedVocab, lyricsLines) {
 const pool = [...(mappedVocab || []), ...(unmappedVocab || [])];
 const lines = (lyricsLines || []).map(l => l && l.text).filter(Boolean);
 const chosen = [];
 for (const item of pool) {
 if (!item || !item.word) continue;
 const target = item.word;
 const sentence = lines.find(L => L.toLowerCase().includes(target.toLowerCase()))
 || `La palabra "${target}".`;
 const template = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
 const blank = sentence.replace(template, '______');

 const distractors = pool
 .filter(p => p && p.word && p.word !== target)
 .map(p => p.word);
 // Pad with language-y dummy distractors when we don't have enough peers.
 while (distractors.length < 3) distractors.push(distractors.length === 0 ? 'casa' : `opcion${distractors.length + 1}`);
 const chosen3 = [...new Set(distractors)].slice(0, 3);
 const options = [target, ...chosen3].sort(() => Math.random() - 0.5);
 const correctIndex = options.indexOf(target);

 chosen.push({
 id: `qlocal-${nanoid(8)}`,
 question_text: blank,
 options,
 correct_index: correctIndex,
 vocab_id: item.vocab_id || item.id || null,
 });
 if (chosen.length >= 5) break;
 }
 return { songId, questions: chosen, generated_at: new Date().toISOString() };
}

// The 3.7-flash model occasionally emits JSON with truncated strings (e.g. an
// unescaped apostrophe at the end of options). Recover from the common cases
// without dropping the whole quiz: try strict parse first, then a series of
// progressively shorter prefixes until one parses.
function parseQuizJson(raw) {
 if (!raw || typeof raw !== 'string') {
 throw new Error('quiz generator: empty model response');
 }
 // Strip leading/trailing whitespace and any "Here is the JSON: " preamble
 // the model occasionally emits.
 let cleaned = raw.trim();
 const codeFence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
 if (codeFence) cleaned = codeFence[1].trim();

 // Try a strict parse first.
 try { return JSON.parse(cleaned); } catch { /* fall through */ }

 // Find the LAST `{` that begins a top-level object — model sometimes
 // emits `prefix stuff {...}`. Use that as our starting point.
 const firstBrace = cleaned.indexOf('{');
 if (firstBrace === -1) {
 throw new Error(`quiz generator: no JSON object in response: ${cleaned.slice(0, 200)}...`);
 }

 // Walk back from the right end of the substring looking for valid JSON.
 // Each iteration: shorten the candidate by trimming back to the previous
 // `{`/`}`. If the trimmed candidate ends mid-question (no `}` or `]`
 // remaining), we try one more pass — balance whatever brackets remain
 // open so we always return the most-complete-at-least-syntactically-
 // valid prefix.
 let end = cleaned.length;
 let attempts = 0;
 while (end > firstBrace && attempts < 64) {
 attempts++;
 const candidate = cleaned.slice(firstBrace, end);
 try { return JSON.parse(candidate); } catch { /* try next pass */ }
 // Find the previous valid object-close or array-close.
 let trimEnd = end;
 while (trimEnd > firstBrace && cleaned[trimEnd - 1] !== '}' && cleaned[trimEnd - 1] !== ']') trimEnd--;
 if (trimEnd === firstBrace) break;
 end = trimEnd;
 // Hard upper bound: don't retry more than a small constant.
 if (attempts >= 64) break;
 }

 // Last pass: take whatever's left from firstBrace to the most recent
 // complete object close (`}`), then balance remaining brackets with `]`
 // and `}` to form a syntactically valid document. We may not have ANY
 // complete question (returns {questions: []}) but at least we return
 // something the /study/start route can accept — even if a perfect quiz
 // isn't possible.
 let lastGoodEnd = firstBrace;
 for (let i = firstBrace; i < cleaned.length; i++) {
 if (cleaned[i] === '}' || cleaned[i] === ']') lastGoodEnd = i + 1;
 }
 if (lastGoodEnd > firstBrace) {
 const partial = cleaned.slice(firstBrace, lastGoodEnd);
 // Count balanced brackets. If incomplete, append closing tokens.
 const opens = (partial.match(/\{/g) || []).length;
 const closes = (partial.match(/\}/g) || []).length;
 const opensArr = (partial.match(/\[/g) || []).length;
 const closesArr = (partial.match(/\]/g) || []).length;
 const tail = '}'.repeat(Math.max(0, opens - closes)) + ']'.repeat(Math.max(0, opensArr - closesArr));
 if (tail) {
 try { return JSON.parse(partial + tail); } catch { /* fall through */ }
 }
 try { return JSON.parse(partial); } catch { /* fall through */ }
 }

 throw new Error(`quiz generator: cannot recover valid JSON: ${cleaned.slice(0, 200)}...`);
}

async function getSongVocab(songId) {
 const rows = db.prepare(`
 SELECT v.id as vocab_id, v.word, v.lemma, v.definition, v.cefr_level, m.line_index, m.char_start
 FROM vocab_items v
 JOIN song_vocab_map m ON v.id = m.vocab_id
 WHERE m.song_id = ?
 `).all(songId);

 const mapped = rows.filter(r => r.line_index !== -1);
 const unmapped = [];

 const allIds = new Set(rows.map(r => r.vocab_id));
 const mappedIds = new Set(mapped.map(r => r.vocab_id));
 for (const id of allIds) {
 if (!mappedIds.has(id)) {
 const item = rows.find(r => r.vocab_id === id);
 unmapped.push({
 vocab_id: item.vocab_id,
 word: item.word,
 lemma: item.lemma,
 definition: item.definition,
 cefr_level: item.cefr_level,
 language_code: 'es'
 });
 }
}

return { mapped, unmapped };
}

async function getLyricsLines(songId) {
 // Prefer the snapshot taken at extraction time. LRCLib returns different
 // neighbouring lyric strings on repeat queries, so re-fetching here would
 // make the quiz reference lyrics that no longer match what's in /api/vocab.
 const snap = db.prepare('SELECT synced_lyrics, plain_lyrics FROM song_lyrics_snapshot WHERE song_id = ?').get(songId);
 if (snap) {
 const text = snap.synced_lyrics || snap.plain_lyrics || '';
 if (text) return text.split('\n').filter(Boolean).map(line => ({
 text: line.replace(/^\s*\[\d{1,2}:\d{1,2}(?:\.\d+)?\]\s*/, '').trim()
 })).filter(l => l.text);
 }
 // Fall back to a live LRCLib fetch ONLY if we have nothing else.
 const track = db.prepare('SELECT track_json FROM song_cache WHERE song_id = ?').get(songId);
 if (track && track.track_json) {
 const { artist_name, track_name } = JSON.parse(track.track_json);
 const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist_name)}&track_name=${encodeURIComponent(track_name)}`;
 try {
 const res = await fetch(url);
 if (res.ok) {
 const data = await res.json();
 const text = data.plainLyrics || data.syncedLyrics || '';
 return text.split('\n').filter(Boolean).map(line => ({ text: line }));
 }
 } catch { /* swallow network error; quiz will get empty lines */ }
 }
 return [];
}

module.exports = {
 generateQuiz,
 getSongVocab,
 getLyricsLines,
 buildQuizPrompt,
 synthesizeLocalQuiz,
 parseQuizJson,
};
