import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReviewChoices } from './reviewChoices.ts';

const SPANISH_JOKES = [
  'un sándwich de calcetines',
  'el primo del refrigerador',
  'una nube con zapatos',
  'una tostadora que canta',
  'la piedra mascota del martes',
  'una bicicleta de sopa',
  'el calcetín izquierdo de la luna',
  'una tormenta educada',
];

describe('review choices', () => {
  it('offers the right meaning, the closest other meaning, and one silly meaning', () => {
    const choices = buildReviewChoices('corto', ['una vida muy larga', 'breve palabra', 'corto'], 'es');
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map((choice) => choice.toLowerCase())).size, 3);
    assert.ok(choices.includes('corto'));
    assert.ok(choices.includes('breve palabra'));
    assert.equal(choices.filter((choice) => SPANISH_JOKES.includes(choice)).length, 1);
  });

  it('still offers three choices when the learner has no other words', () => {
    const choices = buildReviewChoices('corto', ['corto', ''], 'es');
    assert.equal(choices.length, 3);
    assert.ok(choices.includes('corto'));
    assert.ok(choices.includes('algo pequeño'));
    assert.equal(choices.filter((choice) => SPANISH_JOKES.includes(choice)).length, 1);
  });

  it('keeps the silly line in the home language', () => {
    const choices = buildReviewChoices('short', [], 'en');
    assert.ok(choices.some((choice) => choice === 'a sock sandwich' || choice.includes('sock') || choice.includes('toaster') || choice.includes('fridge') || choice.includes('cloud') || choice.includes('Tuesday') || choice.includes('soup') || choice.includes('moon') || choice.includes('thunderstorm')));
    assert.ok(choices.includes('short'));
    assert.ok(choices.includes('a small thing'));
  });
});
