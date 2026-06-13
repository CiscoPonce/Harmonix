const { expect } = require('chai');
const db = require('../db');
const { resolveVocabId, lookupKey } = require('./vocabLookupService');

describe('Vocab Lookup Service', () => {
 beforeEach(() => {
 // Wipe and seed.
 db.prepare('DELETE FROM quiz_answers').run();
 db.prepare('DELETE FROM quiz_sessions').run();
 db.prepare('DELETE FROM user_vocab_progress').run();
 db.prepare('DELETE FROM song_vocab_map').run();
 db.prepare('DELETE FROM vocab_items').run();
 db.prepare(
 `INSERT INTO vocab_items (id, word, lemma, definition, cefr_level, language_code, canonical_key)
 VALUES (?, ?, ?, ?, ?, ?, ?)`
 ).run('v1', 'pasito a pasito', 'pasito', 'steps step by step', 'A2', 'es', 'pasitoapasito|es');
 db.prepare(
 `INSERT INTO vocab_items (id, word, lemma, definition, cefr_level, language_code, canonical_key)
 VALUES (?, ?, ?, ?, ?, ?, ?)`
 ).run('v2', 'corazón', 'corazon', 'heart', 'A1', 'es', 'corazon|es');
 db.prepare(
 `INSERT INTO vocab_items (id, word, lemma, definition, cefr_level, language_code, canonical_key)
 VALUES (?, ?, ?, ?, ?, ?, ?)`
 ).run('v3', 'dando y dandolo', 'dar', 'giving & giving it', 'A2', 'es', 'dandoydandolo|es');
 });

 describe('lookupKey()', () => {
 it('lowercases', () => {
 expect(lookupKey('CORAZÓN')).to.equal('corazon');
 });
 it('strips diacritics', () => {
 expect(lookupKey('corazón')).to.equal('corazon');
 });
 it('collapses spaces, underscores, hyphens', () => {
 expect(lookupKey('pasito a pasito')).to.equal('pasitoapasito');
 expect(lookupKey('pasito_a_pasito')).to.equal('pasitoapasito');
 expect(lookupKey('pasito-a-pasito')).to.equal('pasitoapasito');
 expect(lookupKey('pasito _ - pasito')).to.equal('pasitopasito');
 });
 it('strips Spanish punctuation', () => {
 expect(lookupKey('¿Cómo estás?')).to.equal('comoestas');
 });
 it('handles null/undefined safely', () => {
 expect(lookupKey(null)).to.equal('');
 expect(lookupKey(undefined)).to.equal('');
 });
 });

 describe('resolveVocabId()', () => {
 it('returns null for falsy / non-string inputs', () => {
 expect(resolveVocabId(null)).to.equal(null);
 expect(resolveVocabId(undefined)).to.equal(null);
 expect(resolveVocabId('')).to.equal(null);
 expect(resolveVocabId(42)).to.equal(null);
 });

 it('returns the row id when given an exact nanoid', () => {
 expect(resolveVocabId('v2')).to.equal('v2');
 });

 it('resolves a single word by accent-folded match', () => {
 expect(resolveVocabId('Corazón')).to.equal('v2');
 expect(resolveVocabId('CORAZON')).to.equal('v2');
 expect(resolveVocabId('corazón')).to.equal('v2');
 });

 it('resolves underscored phrase forms (the AI returns these)', () => {
 expect(resolveVocabId('pasito_a_pasito')).to.equal('v1');
 expect(resolveVocabId('dando_y_dandolo')).to.equal('v3');
 });

 it('resolves hyphenated / spaced forms', () => {
 expect(resolveVocabId('pasito a pasito')).to.equal('v1');
 expect(resolveVocabId('CORAZÓN')).to.equal('v2');
 });

 it('returns null for unrelated input', () => {
 expect(resolveVocabId('xyzzy123')).to.equal(null);
 });
 });
});
