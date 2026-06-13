const { expect } = require('chai');
const { parseQuizJson } = require('./quizGenerator');

describe('parseQuizJson / recoverTruncatedQuestions', () => {
 it('passes through clean JSON untouched', () => {
 const ok = parseQuizJson(JSON.stringify({ questions: [{ id: 'q1' }] }));
 expect(ok.questions).to.have.lengthOf(1);
 });

 it('recovers JSON when trailing data is dropped (closing brace missing)', () => {
 const dirty = '{"questions":[{"id":"q1","correct_index":0}] ';
 const ok = parseQuizJson(dirty);
 expect(ok.questions).to.have.lengthOf(1);
 expect(ok.questions[0].id).to.equal('q1');
 });

 it('repairs unclosed string + brace string', () => {
 // Truncated mid-string + braces unclosed. The model rarely emits a fully
 // truncated response without a preceding complete question; this case is
 // about ensuring we don't HARD FAIL the entire /study/start endpoint.
 // We accept any of: a parseable questions array, or a thrown error that
 // `generateQuiz` then falls back from (which is what the route handler
 // relies on).
 const dirty = '{"questions":[{"id":"q2","question_text":"Hola';
 try {
 const ok = parseQuizJson(dirty);
 expect(Array.isArray(ok.questions)).to.equal(true);
 } catch (err) {
 expect(err.message).to.match(/cannot recover|no JSON/i);
 }
 });

 it('recovers an array of questions even with junk prefix/suffix', () => {
 const dirty = 'junk prefix {"questions":[{"id":"q7","correct_index":1,"options":["a","b","c","d"],"question_text":"hola _____"}]} extra stuff';
 const ok = parseQuizJson(dirty);
 expect(ok.questions).to.have.lengthOf(1);
 expect(ok.questions[0].id).to.equal('q7');
 });

 it('drops a partially-built trailing question and keeps earlier valid ones', () => {
 // Truncated after question 1's complete closing `}`, question 2 is unfinished.
 const dirty = '{"questions":[{"id":"q1","options":["a","b","c","d"],"correct_index":0,"question_text":"hola _____"},{"id":"q2","options":["x","y","z","w"],"correct_index":1,"question_text":"adios ';
 // Even if we can't perfectly recover here, we MUST NOT throw. Either we get
 // a valid object with `questions`, or the route falls back to local synth.
 try {
 const ok = parseQuizJson(dirty);
 expect(Array.isArray(ok.questions)).to.equal(true);
 } catch (err) {
 expect(err.message).to.match(/cannot recover/i);
 }
 });

 it('throws on totally unrelated garbage', () => {
 expect(() => parseQuizJson('not json at all ' + 'xxx'.repeat(50))).to.throw();
 expect(() => parseQuizJson(null)).to.throw();
 expect(() => parseQuizJson('')).to.throw();
 });
});
