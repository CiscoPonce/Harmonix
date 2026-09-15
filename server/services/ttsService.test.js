const assert = require('assert');
const ttsService = require('./ttsService');

describe('TTS Service Voice & Accent Normalization', () => {
  it('restores accents for Italian words like perche -> perché', () => {
    assert.strictEqual(ttsService.normalizeWordForTTS('perche', 'it'), 'perché');
    assert.strictEqual(ttsService.normalizeWordForTTS('perche\'', 'it'), 'perché');
    assert.strictEqual(ttsService.normalizeWordForTTS('piu', 'it'), 'più');
    assert.strictEqual(ttsService.normalizeWordForTTS('citta', 'it'), 'città');
  });

  it('restores accents for Spanish words like tambien -> también', () => {
    assert.strictEqual(ttsService.normalizeWordForTTS('tambien', 'es'), 'también');
    assert.strictEqual(ttsService.normalizeWordForTTS('despues', 'es'), 'después');
    assert.strictEqual(ttsService.normalizeWordForTTS('esta', 'es'), 'esta');
    assert.strictEqual(ttsService.normalizeWordForTTS('estan', 'es'), 'estan');
    assert.strictEqual(ttsService.normalizeWordForTTS('mas', 'es'), 'mas');
  });

  it('restores mercoledì not mercoladì', () => {
    assert.strictEqual(ttsService.normalizeWordForTTS('mercoledi', 'it'), 'mercoledì');
  });

  it('assigns native voices for all 6 supported languages', () => {
    assert.strictEqual(ttsService.resolveVoice('it', 'female'), 'giovanni');
    assert.strictEqual(ttsService.resolveVoice('it', 'male'), 'giovanni');
    assert.strictEqual(ttsService.resolveVoice('pt', 'female'), 'lola');
    assert.strictEqual(ttsService.resolveVoice('es', 'female'), 'lola');
    assert.strictEqual(ttsService.resolveVoice('fr', 'female'), 'estelle');
    assert.strictEqual(ttsService.resolveVoice('de', 'female'), 'anna');
    assert.strictEqual(ttsService.resolveVoice('en', 'female'), 'alba');
  });

  it('formats ttsPromptForWord cleanly with punctuation and restored accents', () => {
    assert.strictEqual(ttsService.ttsPromptForWord('perche', 'it'), 'perché.');
    assert.strictEqual(ttsService.ttsPromptForWord('BELLO', 'it'), 'BELLO.');
    assert.strictEqual(ttsService.ttsPromptForWord('mercoledi', 'it'), 'mercoledì.');
  });

  it('skip-spawn reloads Pocket-TTS when the host model language differs', async () => {
    const ttsDaemon = require('./ttsDaemon');
    const prevSkip = process.env.TTS_SKIP_SPAWN;
    const prevLang = ttsDaemon.currentLanguage;
    const origFetch = global.fetch;
    process.env.TTS_SKIP_SPAWN = 'true';
    ttsDaemon.currentLanguage = 'spanish_24l';
    const calls = [];
    global.fetch = async (url, opts = {}) => {
      const href = String(url);
      calls.push({ href, method: opts.method || 'GET', body: opts.body });
      if (href.endsWith('/health')) {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', language: 'spanish_24l' }) };
      }
      if (href.endsWith('/reload')) {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', language: 'english', reloaded: true }) };
      }
      throw new Error(`unexpected fetch ${href}`);
    };
    try {
      await ttsService.ensureDaemonLanguage('en');
      assert.strictEqual(ttsDaemon.currentLanguage, 'english');
      assert.ok(calls.some((c) => c.href.endsWith('/reload') && String(c.body).includes('english')));
    } finally {
      global.fetch = origFetch;
      if (prevSkip === undefined) delete process.env.TTS_SKIP_SPAWN;
      else process.env.TTS_SKIP_SPAWN = prevSkip;
      ttsDaemon.currentLanguage = prevLang;
    }
  });

  it('skip-spawn keeps tts_language_mismatch when the host cannot reload', async () => {
    const ttsDaemon = require('./ttsDaemon');
    const prevSkip = process.env.TTS_SKIP_SPAWN;
    const prevLang = ttsDaemon.currentLanguage;
    const origFetch = global.fetch;
    process.env.TTS_SKIP_SPAWN = 'true';
    ttsDaemon.currentLanguage = 'spanish_24l';
    global.fetch = async (url) => {
      const href = String(url);
      if (href.endsWith('/health')) {
        return { ok: true, status: 200, json: async () => ({ status: 'healthy' }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    try {
      await ttsService.ensureDaemonLanguage('en');
      assert.fail('expected tts_language_mismatch');
    } catch (err) {
      assert.strictEqual(err.code, 'tts_language_mismatch');
    } finally {
      global.fetch = origFetch;
      if (prevSkip === undefined) delete process.env.TTS_SKIP_SPAWN;
      else process.env.TTS_SKIP_SPAWN = prevSkip;
      ttsDaemon.currentLanguage = prevLang;
    }
  });

  it('treats generated silence as unusable audio', () => {
    const silent = ttsService.generateSilentWavBuffer();
    assert.strictEqual(ttsService.wavLooksSilent(silent), true);
  });

  it('treats a loud click shorter than a spoken word as unusable audio', () => {
    const rate = 24000;
    const samples = Math.floor(rate * 0.08);
    const pcm = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) pcm.writeInt16LE(12000, i * 2);
    const wav = ttsService.generateSilentWavBuffer(rate, 0.08);
    wav.set(pcm, 44);
    assert.strictEqual(ttsService.wavLooksSilent(wav), true);
  });

  it('trims long silent tails around the spoken samples', () => {
    const rate = 24000;
    const total = rate * 2;
    const pcm = Buffer.alloc(total * 2);
    const start = rate; // 1s in
    for (let i = 0; i < rate * 0.3; i++) pcm.writeInt16LE(8000, (start + i) * 2);
    const trimmed = ttsService.trimPcmToSpeech(pcm, rate);
    const durMs = (trimmed.length / 2 / rate) * 1000;
    assert.ok(durMs > 300 && durMs < 500, `unexpected trim duration ${durMs}`);
  });

  it('maps language aliases onto the same Pocket-TTS family', () => {
    assert.strictEqual(ttsService.canonicalPocketLang('es'), 'spanish_24l');
    assert.strictEqual(ttsService.pocketLangFamily('es'), 'spanish');
    assert.strictEqual(ttsService.pocketLangFamily('spanish_24l'), 'spanish');
    assert.strictEqual(ttsService.pocketLangFamily('en'), 'english');
  });
});
