import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRANSLATIONS, getTranslation, getPlural, type LanguageCode } from './i18n.dictionary.ts';

describe('Web Client i18n Translations', () => {
  const languages: LanguageCode[] = ['en', 'es', 'fr', 'de', 'pt', 'it'];

  it('interpolates {vars} and picks plural forms', () => {
    assert.strictEqual(getTranslation('n_ready', 'en', { n: 4 }), '4 ready');
    assert.strictEqual(getTranslation('n_ready', 'es', { n: 4 }), '4 listas');
    assert.strictEqual(getPlural('streak_days', 1, 'en'), '1 day');
    assert.strictEqual(getPlural('streak_days', 3, 'de'), '3 Tage');
    // Unknown placeholder is left intact rather than becoming "undefined".
    assert.strictEqual(getTranslation('word_around', 'en', {}), 'Word around {time}');
  });
  const baseKeys = Object.keys(TRANSLATIONS.en);

  languages.forEach((lang) => {
    it(`has complete translation dictionary for ${lang}`, () => {
      const dict = TRANSLATIONS[lang];
      assert.ok(dict);

      baseKeys.forEach((key) => {
        assert.ok(dict[key]);
        assert.strictEqual(typeof dict[key], 'string');
        assert.ok(dict[key].length > 0);
      });
    });
  });

  it('translates correctly with fallback to English for unknown keys', () => {
    assert.strictEqual(getTranslation('nav_discover', 'es'), 'Descubrir');
    assert.strictEqual(getTranslation('nav_discover', 'fr'), 'Découvrir');
    assert.strictEqual(getTranslation('nav_discover', 'de'), 'Entdecken');
    assert.strictEqual(getTranslation('unknown_key_test', 'es'), 'unknown_key_test');
  });
});
