// SM-2 inspired Spaced Repetition System.
// Quality scale (performance) used by Anki / SM-2:
//  5 - perfect response
//  4 - correct after hesitation
//  3 - correct with serious difficulty
//  2 - incorrect, but remembered upon seeing answer
//  1 - incorrect, familiar answer
//  0 - blackout, total failure

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

/**
 * Calculate next review parameters given current state and performance.
 * @param {Object} state - { stability, difficulty, reps }
 * @param {number} performance - 0..5 quality score
 * @returns {Object} - { nextInterval, newStability, newDifficulty, easeFactor }
 */
function calculateNextReview(state, performance) {
 const prevStability = state.stability || 0;
 const prevDifficulty = state.difficulty || 0;
 const reps = state.reps || 0;

 let easeFactor = state.easeFactor || DEFAULT_EASE;
 if (typeof state.easeFactor === 'undefined') {
 easeFactor = DEFAULT_EASE;
 }

 if (performance < 3) {
 return {
 nextInterval: 1,
 newStability: Math.max(0.5, prevStability * 0.4),
 newDifficulty: Math.min(10, prevDifficulty + 1.2),
 easeFactor: Math.max(MIN_EASE, easeFactor - 0.2),
 reps: reps + 1
 };
 }

 const newDifficulty = Math.max(0, prevDifficulty - 0.15 + (5 - performance) * 0.05);
 const qualityAdj = performance - 3; // 0..2 for correct answers
 const easeDelta = 0.1 - (5 - performance) * (0.08 + (5 - performance) * 0.02);
 const newEaseFactor = Math.max(MIN_EASE, easeFactor + easeDelta);

 const newStability = prevStability === 0
 ? Math.pow(newEaseFactor, 1 + qualityAdj / 2)
 : Math.max(prevStability, prevStability * newEaseFactor * (1 + qualityAdj / 10));

 const nextInterval = Math.max(1, Math.round(newStability));

 return {
 nextInterval,
 newStability,
 newDifficulty,
 easeFactor: newEaseFactor,
 reps: reps + 1
 };
}

/**
 * Convert a correctness (boolean) plus response time to SM-2 performance.
 * Fast correct = 5; slow correct = 3; incorrect = 1.
 */
function correctnessToPerformance(isCorrect, responseMs = 3000) {
 if (!isCorrect) return 1;
 if (responseMs < 1500) return 5;
 if (responseMs < 3000) return 4;
 return 3;
}

/**
 * Pick the next due date given a calculated interval in days.
 */
function nextReviewDate(intervalDays) {
 const d = new Date();
 d.setDate(d.getDate() + intervalDays);
 return d.toISOString();
}

module.exports = {
 calculateNextReview,
 correctnessToPerformance,
 nextReviewDate,
 DEFAULT_EASE,
 MIN_EASE,
};
