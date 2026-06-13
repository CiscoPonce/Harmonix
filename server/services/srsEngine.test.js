const { expect } = require('chai');
const { calculateNextReview, correctnessToPerformance, nextReviewDate } = require('./srsEngine');

describe('SRS Engine', () => {
 describe('calculateNextReview', () => {
 it('returns short interval for incorrect answers', () => {
 const result = calculateNextReview({ stability: 10, difficulty: 2, reps: 5 }, 1);
 expect(result.nextInterval).to.equal(1);
 expect(result.reps).to.equal(6);
 expect(result.easeFactor).to.be.lessThan(2.5);
 });

 it('increases stability for perfect answers', () => {
 const prev = { stability: 2, difficulty: 3, easeFactor: 2.5, reps: 3 };
 const result = calculateNextReview(prev, 5);
 expect(result.newStability).to.be.greaterThan(prev.stability);
 expect(result.reps).to.equal(4);
 });

 it('handles first-time (zero stability) card', () => {
 const result = calculateNextReview({ stability: 0, difficulty: 0, easeFactor: 2.5, reps: 0 }, 4);
 expect(result.nextInterval).to.be.at.least(1);
 expect(result.newStability).to.be.greaterThan(0);
 });

 it('does not drop stability below 0.5 on failure', () => {
 const result = calculateNextReview({ stability: 10, difficulty: 5, easeFactor: 1.3, reps: 10 }, 0);
 expect(result.newStability).to.be.at.least(0.5);
 });

 it('clamps ease factor to minimum', () => {
 const result = calculateNextReview({ stability: 5, difficulty: 5, easeFactor: 1.3, reps: 5 }, 0);
 expect(result.easeFactor).to.be.at.least(1.3);
 });
 });

 describe('correctnessToPerformance', () => {
 it('returns 1 for incorrect', () => {
 expect(correctnessToPerformance(false)).to.equal(1);
 });

 it('returns 5 for fast correct', () => {
 expect(correctnessToPerformance(true, 1000)).to.equal(5);
 });

 it('returns 3 for slow correct', () => {
 expect(correctnessToPerformance(true, 5000)).to.equal(3);
 });
 });

 describe('nextReviewDate', () => {
 it('returns ISO string for n days in the future', () => {
 const date = nextReviewDate(5);
 const d = new Date(date);
 const expected = new Date();
 expected.setDate(expected.getDate() + 5);
 expect(d.toISOString().slice(0, 10)).to.equal(expected.toISOString().slice(0, 10));
 });
 });
});
