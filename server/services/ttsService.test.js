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
  });

  it('assigns native voices for all 6 supported languages', () => {
    assert.strictEqual(ttsService.resolveVoice('it', 'female'), 'fiammetta');
    assert.strictEqual(ttsService.resolveVoice('it', 'male'), 'marcos');
    assert.strictEqual(ttsService.resolveVoice('pt', 'female'), 'camila');
    assert.strictEqual(ttsService.resolveVoice('es', 'female'), 'lola');
    assert.strictEqual(ttsService.resolveVoice('fr', 'female'), 'estelle');
    assert.strictEqual(ttsService.resolveVoice('de', 'female'), 'anna');
    assert.strictEqual(ttsService.resolveVoice('en', 'female'), 'alba');
  });

  it('formats ttsPromptForWord cleanly with punctuation and restored accents', () => {
    assert.strictEqual(ttsService.ttsPromptForWord('perche', 'it'), 'perché.');
    assert.strictEqual(ttsService.ttsPromptForWord('BELLO', 'it'), 'BELLO.');
  });
});
