const assert = require('assert');
const {
  KOKORO_LANG_MAP,
  KOKORO_VOICES_FEMALE,
  KOKORO_VOICES_MALE,
} = require('./kokoroService');

describe('Kokoro-82M ONNX Service Mapping', () => {
  it('maps supported 6 languages to kokoro language codes', () => {
    assert.strictEqual(KOKORO_LANG_MAP.it, 'it');
    assert.strictEqual(KOKORO_LANG_MAP.fr, 'fr-fr');
    assert.strictEqual(KOKORO_LANG_MAP.es, 'es');
    assert.strictEqual(KOKORO_LANG_MAP.pt, 'pt-br');
    assert.strictEqual(KOKORO_LANG_MAP.en, 'en-us');
  });

  it('assigns female studio voices across languages', () => {
    assert.strictEqual(KOKORO_VOICES_FEMALE.it, 'if_sara');
    assert.strictEqual(KOKORO_VOICES_FEMALE.es, 'ef_dora');
    assert.strictEqual(KOKORO_VOICES_FEMALE.fr, 'ff_siwis');
    assert.strictEqual(KOKORO_VOICES_FEMALE.pt, 'pf_dora');
    assert.strictEqual(KOKORO_VOICES_FEMALE.en, 'af_heart');
  });

  it('assigns male studio voices across languages', () => {
    assert.strictEqual(KOKORO_VOICES_MALE.it, 'im_nicola');
    assert.strictEqual(KOKORO_VOICES_MALE.es, 'em_alex');
    assert.strictEqual(KOKORO_VOICES_MALE.fr, 'fm_denis');
    assert.strictEqual(KOKORO_VOICES_MALE.pt, 'pm_alex');
    assert.strictEqual(KOKORO_VOICES_MALE.en, 'am_adam');
  });

  it('trims leading and trailing silence from float32 audio arrays', () => {
    const { trimPcmSilence } = require('./kokoroService');
    const raw = new Float32Array([0, 0, 0, 0.05, 0.2, 0.8, 0.05, 0, 0, 0]);
    const trimmed = trimPcmSilence(raw, 0.01, 1);
    assert.strictEqual(trimmed.length, 6);
  });
});
