const { expect } = require('chai');
const quizModule = require('./quizGenerator');
const { buildQuizPrompt } = quizModule;
const db = require('../db');

describe('Quiz Generator - Prompt Builder', () => {
 it('includes target vocabulary and lyrics in prompt', () => {
 const mapped = [{ vocab_id: 'v1', word: 'amor' }];
 const unmapped = [{ vocab_id: 'v2', word: 'corazón', lemma: 'corazon' }];
 const lyricsLines = [{ text: 'El amor es bello' }];

 const prompt = buildQuizPrompt(mapped, unmapped, lyricsLines);

 expect(prompt).to.contain('amor');
 expect(prompt).to.contain('corazón');
 expect(prompt).to.contain('El amor es bello');
 });

 it('uses lemma when available', () => {
 const mapped = [{ vocab_id: 'v1', word: 'corriendo', lemma: 'correr' }];
 const lyricsLines = [{ text: 'Voy corriendo' }];

 const prompt = buildQuizPrompt(mapped, [], lyricsLines);

 expect(prompt).to.contain('correr');
 });
});

describe('Quiz Generator - Local Fallback', () => {
 it('emits a non-empty quiz with one question per vocab word (max 5)', () => {
 // Wipe any leftover rows (children first)
 db.prepare('DELETE FROM quiz_answers').run();
 db.prepare('DELETE FROM quiz_sessions').run();
 db.prepare('DELETE FROM user_vocab_progress').run();
 db.prepare('DELETE FROM song_vocab_map').run();
 db.prepare('DELETE FROM vocab_items').run();

 const mapped = [
 { vocab_id: 'vm1', word: 'amor', lemma: 'amor' },
 { vocab_id: 'vm2', word: 'corazón', lemma: 'corazon' },
 { vocab_id: 'vm3', word: 'despacito', lemma: 'despacito' }
 ];
 const unmapped = [{ vocab_id: 'vu1', word: 'fonsi', lemma: 'fonsi' }];
 const lines = [
 { text: 'El amor es bello y tiene corazón.' },
 { text: 'Despacito quiero respirar de tu despacito.' }
 ];

 const result = quizModule.synthesizeLocalQuiz('sng', mapped, unmapped, lines);
 expect(result.questions).to.have.length.at.least(3);
 expect(result.questions.length).to.be.at.most(5);

 // Every question has the contract fields.
 for (const q of result.questions) {
 expect(q.id).to.be.a('string');
 expect(q.question_text).to.contain('______');
 expect(q.options).to.have.lengthOf(4);
 expect(q.correct_index).to.be.oneOf([0, 1, 2, 3]);
 // The correct option must match one of the vocab words.
 expect(mapped.concat(unmapped).some(v => v.word === q.options[q.correct_index])).to.equal(true);
 }
 });

 it('returns 0 questions for empty vocab', () => {
 const r = quizModule.synthesizeLocalQuiz('x', [], [], []);
 expect(r.questions).to.deep.equal([]);
 });
});

describe('Quiz Generator - PDF-style malformed JSON recovery', () => {
 // Detailed recovery tests for truncated/malformed model output live in
 // quizParser.test.js — keeping this file focused on the prompt builder +
 // local fallback paths.
});
