const db = require('../db');
const ttsDaemon = require('./ttsDaemon');

const VOICE_MAP = {
  es: 'lola',
  fr: 'estelle',
  de: 'juergen',
  pt: 'rafael',
  en: 'alba',
  it: 'giovanni',
};

const SUPPORTED_LANGUAGES = Object.keys(VOICE_MAP);

function padWavWithSilence(wavBuffer, sampleRate = 24000, silenceSeconds = 1) {
  const HEADER_SIZE = 44;
  const BYTES_PER_SAMPLE = 2;
  const silenceBytes = sampleRate * silenceSeconds * BYTES_PER_SAMPLE;
  const silence = Buffer.alloc(silenceBytes, 0);
  const pcmData = wavBuffer.subarray(HEADER_SIZE);
  const paddedPcm = Buffer.concat([silence, pcmData, silence]);
  const result = Buffer.alloc(HEADER_SIZE + paddedPcm.length);
  wavBuffer.copy(result, 0, 0, HEADER_SIZE);
  paddedPcm.copy(result, HEADER_SIZE);
  result.writeUInt32LE(result.length - 8, 4);
  result.writeUInt32LE(paddedPcm.length, 40);
  return result;
}

function getCachedPronunciation(word) {
  const row = db.prepare('SELECT audio_blob FROM word_pronunciation_cache WHERE word = ?').get(word);
  return row ? row.audio_blob : undefined;
}

function cachePronunciation(word, audioBlob) {
  db.prepare('INSERT OR IGNORE INTO word_pronunciation_cache (word, audio_blob) VALUES (?, ?)').run(word, audioBlob);
}

async function fetchFromPocketTTS(word, voiceUrl) {
  const params = new URLSearchParams();
  params.append('text', word);
  params.append('voice_url', voiceUrl);

  const res = await fetch('http://127.0.0.1:3002/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = new Error(`Pocket-TTS returned ${res.status}`);
    err.code = 'tts_generation_failed';
    throw err;
  }

  return Buffer.from(await res.arrayBuffer());
}

async function getPronunciationForWord(word, langCode) {
  if (!SUPPORTED_LANGUAGES.includes(langCode)) {
    const err = new Error('unsupported_language');
    err.code = 'unsupported_language';
    throw err;
  }

  const cached = getCachedPronunciation(word);
  if (cached) return cached;

  if (ttsDaemon.currentLanguage !== langCode) {
    await ttsDaemon.restart(langCode);
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await ttsDaemon.healthCheck()) break;
    }
  }

  const wavBuffer = await fetchFromPocketTTS(word, VOICE_MAP[langCode]);
  const padded = padWavWithSilence(wavBuffer);
  cachePronunciation(word, padded);
  return padded;
}

async function preCachePronunciation(word, langCode) {
  try {
    await getPronunciationForWord(word, langCode);
  } catch {
    // fire-and-forget: swallow all errors
  }
}

module.exports = {
  VOICE_MAP,
  SUPPORTED_LANGUAGES,
  padWavWithSilence,
  getPronunciationForWord,
  preCachePronunciation,
  getCachedPronunciation,
};
