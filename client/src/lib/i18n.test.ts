import assert from 'node:assert/strict';
import { test, describe, it } from 'node:test';
import { TRANSLATIONS, getTranslation, LanguageCode } from './i18n.ts';

describe('Web Client i18n Translations', () => {
  const languages: LanguageCode[] = ['en', 'es', 'fr', 'de', 'pt', 'it'];
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
