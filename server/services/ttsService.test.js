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

  it('skip-spawn refuses Pocket-TTS when the host model language differs', async () => {
    const ttsDaemon = require('./ttsDaemon');
    const prevSkip = process.env.TTS_SKIP_SPAWN;
    const prevLang = ttsDaemon.currentLanguage;
    process.env.TTS_SKIP_SPAWN = 'true';
    ttsDaemon.currentLanguage = 'spanish_24l';
    try {
      await ttsService.ensureDaemonLanguage('en');
      assert.fail('expected tts_language_mismatch');
    } catch (err) {
      assert.strictEqual(err.code, 'tts_language_mismatch');
    } finally {
      if (prevSkip === undefined) delete process.env.TTS_SKIP_SPAWN;
      else process.env.TTS_SKIP_SPAWN = prevSkip;
      ttsDaemon.currentLanguage = prevLang;
    }
  });
});
