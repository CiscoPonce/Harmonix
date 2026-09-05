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

  it('generates valid RIFF WAV audio buffer via kokoroService', async function () {
    // Integration test: needs a Python env with kokoro installed. Skip elsewhere
    // (CI, laptops without the venv) instead of failing the suite.
    if (process.env.KOKORO_INTEGRATION !== '1') this.skip();
    this.timeout(20000);
    const { generateKokoroAudio } = require('./kokoroService');
    const res = await generateKokoroAudio('perché', 'it');
    assert.ok(res && res.audio);
    assert.strictEqual(res.audio.slice(0, 4).toString(), 'RIFF');
  });

  it('remembers a missing Kokoro runtime and skips the spawn', async () => {
    const svc = require('./kokoroService');
    const disabled = process.env.KOKORO_DISABLED;
    delete process.env.KOKORO_DISABLED; // CI sets it; this test exercises the runtime flag
    try {
      svc.__resetKokoroAvailabilityForTest();
      assert.strictEqual(svc.isKokoroUnavailable(), false);
      svc.markKokoroUnavailable('test');
      assert.strictEqual(svc.isKokoroUnavailable(), true);
      const res = await svc.generateKokoroAudio('hola', 'es');
      assert.strictEqual(res, null);
    } finally {
      svc.__resetKokoroAvailabilityForTest();
      if (disabled !== undefined) process.env.KOKORO_DISABLED = disabled;
    }
  });

  it('KOKORO_DISABLED=true short-circuits without spawning', async () => {
    const svc = require('./kokoroService');
    const prev = process.env.KOKORO_DISABLED;
    process.env.KOKORO_DISABLED = 'true';
    try {
      assert.strictEqual(svc.isKokoroUnavailable(), true);
      assert.strictEqual(await svc.generateKokoroAudio('hola', 'es'), null);
    } finally {
      if (prev === undefined) delete process.env.KOKORO_DISABLED;
      else process.env.KOKORO_DISABLED = prev;
    }
  });
});
