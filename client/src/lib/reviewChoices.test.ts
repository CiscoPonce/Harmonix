import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReviewChoices } from './reviewChoices.ts';

describe('review choices', () => {
  it('offers the real meaning and two other meanings from the learner', () => {
    const choices = buildReviewChoices('corto', ['dinero', 'vida', 'corto', '  Dinero  ']);
    assert.equal(choices.length, 3);
    assert.ok(choices.some((choice) => choice.toLowerCase() === 'corto'));
    const lowered = choices.map((choice) => choice.toLowerCase());
    assert.equal(new Set(lowered).size, 3);
    for (const choice of lowered) {
      assert.ok(['corto', 'dinero', 'vida'].includes(choice));
    }
  });

  it('does not invent a third choice when the learner only has one other word', () => {
    const choices = buildReviewChoices('corto', ['corto', '']);
    assert.deepEqual(choices, ['corto']);
  });
});
