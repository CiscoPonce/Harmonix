const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../db');
const ttsDaemon = require('./ttsDaemon');

const VOICE_MAP_FEMALE = {
  es: 'lola',
  fr: 'estelle',
  de: 'anna',
  pt: 'lola',
  en: 'alba',
  it: 'giovanni',
};

const VOICE_MAP_MALE = {
  es: 'rafael',
  fr: 'jean',
  de: 'juergen',
  pt: 'rafael',
  en: 'charles',
  it: 'giovanni',
};

const ACCENT_RESTORE_MAP = {
  it: {
    'perche': 'perché',
    'perche\'': 'perché',
    'poiche': 'poiché',
    'affinche': 'affinché',
    'cosi': 'così',
    'gia': 'già',
    'gia\'': 'già',
    'piu': 'più',
    'piu\'': 'più',
    'puo': 'può',
    'puo\'': 'può',
    'cioe': 'cioè',
    'citta': 'città',
    'verita': 'verità',
    'virtu': 'virtù',
    'lunedi': 'lunedì',
    'martedi': 'martedì',
    'mercoledi': 'mercoledì',
    'giovedi': 'giovedì',
    'venerdi': 'venerdì',
  },
  es: {
    'perche': 'por qué',
    'tambien': 'también',
    'despues': 'después',
    'aqui': 'aquí',
    'alla': 'allá',
  },
  fr: {
    'tres': 'très',
    'deja': 'déjà',
    'apres': 'après',
  },
  pt: {
    'tambem': 'também',
    'voce': 'você',
    'ate': 'até',
    'ja': 'já',
  },
};

function normalizeWordForTTS(word, langCode = 'es') {
  const w = String(word || '').trim();
  if (!w) return w;
  const lower = w.toLowerCase();
  const langMap = ACCENT_RESTORE_MAP[langCode];
  if (langMap && langMap[lower]) {
    const target = langMap[lower];
    if (w === w.toUpperCase()) return target.toUpperCase();
    if (w[0] === w[0].toUpperCase()) return target[0].toUpperCase() + target.slice(1);
    return target;
  }
  return w;
}

/** @deprecated Prefer resolveVoice(lang, gender) */
const VOICE_MAP = VOICE_MAP_FEMALE;

const POCKET_LANG_MAP = {
  en: 'english',
  es: 'spanish_24l',
  fr: 'french_24l',
  de: 'german_24l',
  pt: 'portuguese_24l',
  it: 'italian_24l',
};

/** Bump to invalidate SQLite pronunciation cache after quality/speed/accent changes. */
const CACHE_VERSION = 'hq-v13-lang-match';

/** Playback tempo (1.0 = natural speed, no phase distortion on sibilants). */
const SPEECH_TEMPO = Number(process.env.POCKET_TTS_TEMPO || '0.95');

/** Silence before and after the word (seconds). */
const LEAD_SILENCE_SEC = Number(process.env.POCKET_TTS_LEAD_SILENCE || '0.05');
const TRAIL_SILENCE_SEC = Number(process.env.POCKET_TTS_TRAIL_SILENCE || '0.10');

const SUPPORTED_LANGUAGES = Object.keys(VOICE_MAP);

function buildCleanWav(pcm, sampleRate = 24000) {
  const dataLen = pcm.length;
  const out = Buffer.alloc(44 + dataLen);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + dataLen, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); // pcm fmt chunk size
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // mono
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28); // byte rate
  out.writeUInt16LE(2, 32); // block align
  out.writeUInt16LE(16, 34); // bits
  out.write('data', 36);
  out.writeUInt32LE(dataLen, 40);
  pcm.copy(out, 44);
  return out;
}

/**
 * Pocket-TTS HTTP streaming returns a non-seekable WAV (often fmt + LIST / bogus sizes)
 * that ffmpeg rejects. Rebuild a clean mono 16-bit PCM WAV.
 */
function normalizeStreamingWav(wavBuffer) {
  if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 44) return wavBuffer;
  if (wavBuffer.slice(0, 4).toString() !== 'RIFF' || wavBuffer.slice(8, 12).toString() !== 'WAVE') {
    return wavBuffer;
  }

  let sampleRate = 24000;
  let dataPcm = null;

  let pos = 12;
  while (pos + 8 <= wavBuffer.length) {
    const id = wavBuffer.slice(pos, pos + 4).toString('ascii');
    const size = wavBuffer.readUInt32LE(pos + 4);
    const dataStart = pos + 8;

    if (id === 'fmt ' && size >= 16) {
      sampleRate = wavBuffer.readUInt32LE(dataStart + 4) || 24000;
    }

    if (id === 'data') {
      if (size === 0xFFFFFFFF || dataStart + size > wavBuffer.length) {
        dataPcm = wavBuffer.subarray(dataStart);
      } else {
        dataPcm = wavBuffer.subarray(dataStart, dataStart + size);
      }
      break;
    }

    // Streaming writer may emit LIST as a container; remaining bytes are PCM (possibly zero-padded).
    if (id === 'LIST') {
      dataPcm = wavBuffer.subarray(dataStart);
      // Drop trailing odd byte
      if (dataPcm.length % 2 === 1) dataPcm = dataPcm.subarray(0, dataPcm.length - 1);
      break;
    }

    if (size > wavBuffer.length) break;
    pos = dataStart + size + (size % 2);
    if (pos <= dataStart) break;
  }

  if (!dataPcm || dataPcm.length < 64) {
    // Fallback: everything after a standard 44-byte header
    dataPcm = wavBuffer.subarray(44);
    if (dataPcm.length % 2 === 1) dataPcm = dataPcm.subarray(0, dataPcm.length - 1);
  }

  return buildCleanWav(dataPcm, sampleRate);
}

/** Linear fade-in to remove start click/bump from atempo. */
function fadeInPcm(pcm, sampleRate = 24000, fadeSeconds = 0.025) {
  const fadeSamples = Math.min(
    Math.round(sampleRate * fadeSeconds),
    Math.floor(pcm.length / 2),
  );
  if (fadeSamples <= 1) return pcm;
  const out = Buffer.from(pcm);
  for (let i = 0; i < fadeSamples; i++) {
    const gain = i / fadeSamples;
    const sample = out.readInt16LE(i * 2);
    out.writeInt16LE(Math.round(sample * gain), i * 2);
  }
  return out;
}

/**
 * Safe peak normalization so the spoken word is clear without digital clipping.
 */
function loudnessNormalizePcm(pcm, { targetPeak = 0.90 } = {}) {
  if (!Buffer.isBuffer(pcm) || pcm.length < 4) return pcm;

  let maxVal = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const s = Math.abs(pcm.readInt16LE(i));
    if (s > maxVal) maxVal = s;
  }
  if (maxVal < 100) return pcm; // avoid boosting silence

  const scale = (32767 * targetPeak) / maxVal;
  if (scale <= 1.05 && scale >= 0.95) return pcm; // already well-leveled

  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    let v = Math.round(pcm.readInt16LE(i) * scale);
    if (v > 32767) v = 32767;
    if (v < -32768) v = -32768;
    out.writeInt16LE(v, i);
  }
  return out;
}

function padWavWithSilence(
  wavBuffer,
  sampleRate = 24000,
  {
    leadSeconds = LEAD_SILENCE_SEC,
    trailSeconds = TRAIL_SILENCE_SEC,
  } = {},
) {
  const clean = normalizeStreamingWav(wavBuffer);
  const faded = fadeInPcm(clean.subarray(44), sampleRate, 0.015);
  const pcmData = loudnessNormalizePcm(faded);
  const lead = Buffer.alloc(Math.round(sampleRate * leadSeconds * 2), 0);
  const trail = Buffer.alloc(Math.round(sampleRate * trailSeconds * 2), 0);
  return buildCleanWav(Buffer.concat([lead, pcmData, trail]), sampleRate);
}

function normalizeVoiceGender(gender) {
  return String(gender || '').toLowerCase() === 'male' ? 'male' : 'female';
}

function resolveVoice(langCode, gender = 'female') {
  const g = normalizeVoiceGender(gender);
  const map = g === 'male' ? VOICE_MAP_MALE : VOICE_MAP_FEMALE;
  return map[langCode] || VOICE_MAP_FEMALE.en;
}

function cacheKey(word, langCode = '', gender = 'female') {
  return `${CACHE_VERSION}::${langCode}::${normalizeVoiceGender(gender)}::${String(word || '').trim()}`;
}

function getCachedPronunciation(word, langCode = '', gender = 'female') {
  const row = db.prepare('SELECT audio_blob FROM word_pronunciation_cache WHERE word = ?').get(
    cacheKey(word, langCode, gender)
  );
  return row ? row.audio_blob : undefined;
}

function cachePronunciation(word, audioBlob, langCode = '', gender = 'female') {
  db.prepare('INSERT OR IGNORE INTO word_pronunciation_cache (word, audio_blob) VALUES (?, ?)').run(
    cacheKey(word, langCode, gender),
    audioBlob
  );
}

function ttsPromptForWord(word, langCode = 'es') {
  const normalized = normalizeWordForTTS(word, langCode);
  const w = String(normalized || '').trim();
  if (!w) return w;
  if (/[.!?]$/.test(w)) return w;
  return `${w}.`;
}

/**
 * Speech tempo adjustment via ffmpeg atempo on clean WAV.
 */
async function slowWav(wavBuffer, tempo = SPEECH_TEMPO) {
  const rate = Math.min(2, Math.max(0.5, Number(tempo) || 0.95));
  const clean = normalizeStreamingWav(wavBuffer);
  if (Math.abs(rate - 1) < 0.01) return clean;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harmonix-tts-'));
  const inputPath = path.join(dir, 'in.wav');
  const outputPath = path.join(dir, 'out.wav');

  try {
    fs.writeFileSync(inputPath, clean);
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', inputPath,
        '-filter:a', `atempo=${rate},afade=t=in:st=0:d=0.015`,
        '-ar', '24000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        outputPath,
      ]);
      let stderr = '';
      proc.stderr.on('data', (c) => { stderr += c.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(stderr.trim() || `ffmpeg exit ${code}`));
        else resolve();
      });
    });
    return fs.readFileSync(outputPath);
  } catch (err) {
    console.warn('[ttsService] ffmpeg atempo failed:', err.message || err);
    return clean;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function fetchFromPocketTTS(word, voiceUrl, langCode = 'es') {
  const params = new URLSearchParams();
  params.append('text', ttsPromptForWord(word, langCode));
  params.append('voice_url', voiceUrl);

  const res = await fetch(`${ttsDaemon.baseUrl()}/tts`, {
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

async function ensureDaemonLanguage(langCode) {
  const pocketLang = POCKET_LANG_MAP[langCode] || 'english';

  // Host systemd TTS (Coolify): never spawn/restart, never lie that the
  // Spanish model is English. Kokoro handles other languages; Pocket-TTS
  // only runs when the loaded model already matches.
  if (ttsDaemon.skipSpawn()) {
    const loaded = ttsDaemon.currentLanguage
      || process.env.POCKET_TTS_DEFAULT_LANGUAGE
      || 'spanish_24l';
    ttsDaemon.currentLanguage = loaded;
    if (loaded !== pocketLang) {
      const err = new Error(
        `Pocket-TTS host model is ${loaded}; requested ${pocketLang}`
      );
      err.code = 'tts_language_mismatch';
      throw err;
    }
    if (!(await ttsDaemon.healthCheck())) {
      const err = new Error('Pocket-TTS daemon unavailable');
      err.code = 'tts_unavailable';
      throw err;
    }
    return;
  }

  // Fast path: healthy daemon already on the right language.
  if (ttsDaemon.currentLanguage === pocketLang && (await ttsDaemon.healthCheck())) {
    return;
  }

  // Adopt a healthy orphan daemon (API restarted; TTS kept running).
  // Avoid a multi-second model reload — synthesize with the live model.
  if (await ttsDaemon.healthCheck()) {
    if (ttsDaemon.currentLanguage === pocketLang) {
      return;
    }
    if (!ttsDaemon.currentLanguage) {
      // Unknown loaded language — do not assume it matches the request.
      const err = new Error('Pocket-TTS language unknown; refusing to guess');
      err.code = 'tts_language_mismatch';
      throw err;
    }
    // Different language loaded — must restart to swap model weights.
  }

  await ttsDaemon.restart(pocketLang);
  const maxRetries = process.env.NODE_ENV === 'test' ? 3 : 120;
  const pollInterval = process.env.NODE_ENV === 'test' ? 100 : 400;
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));
    if (await ttsDaemon.healthCheck()) {
      ttsDaemon.currentLanguage = pocketLang;
      return;
    }
  }
  const err = new Error('Pocket-TTS daemon failed to become ready');
  err.code = 'tts_unavailable';
  throw err;
}

function generateSilentWavBuffer(sampleRate = 24000, durationSec = 0.5) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function getPronunciationForWord(word, langCode, gender = 'female') {
  if (!SUPPORTED_LANGUAGES.includes(langCode)) {
    const err = new Error('unsupported_language');
    err.code = 'unsupported_language';
    throw err;
  }

  const voiceGender = normalizeVoiceGender(gender);
  const cached = getCachedPronunciation(word, langCode, voiceGender);
  if (cached) return cached;

  const kokoroService = require('./kokoroService');
  const tryKokoro = async () => {
    try {
      const kokoroRes = await kokoroService.generateKokoroAudio(word, langCode, voiceGender);
      if (kokoroRes && kokoroRes.audio) {
        cachePronunciation(word, kokoroRes.audio, langCode, voiceGender);
        return kokoroRes.audio;
      }
    } catch (kErr) {
      console.warn('[ttsService] Kokoro audio skipped:', kErr.message || kErr);
    }
    return null;
  };
  const tryPocket = async () => {
    try {
      await ensureDaemonLanguage(langCode);
      const wavBuffer = await fetchFromPocketTTS(word, resolveVoice(langCode, voiceGender), langCode);
      const slowed = await slowWav(wavBuffer, SPEECH_TEMPO);
      const padded = padWavWithSilence(slowed);
      cachePronunciation(word, padded, langCode, voiceGender);
      return padded;
    } catch (pErr) {
      console.warn('[ttsService] Pocket-TTS unavailable:', pErr.message || pErr);
    }
    return null;
  };

  // Production: the host Pocket-TTS daemon already has the (Spanish) model
  // loaded and answers in ~300ms; a Kokoro spawn costs seconds even when it
  // works. Go to the daemon first when it can serve this language, otherwise
  // Kokoro first (other languages / local dev).
  const pocketFirst = pocketCanServe(langCode) || kokoroService.isKokoroUnavailable();
  const order = pocketFirst ? [tryPocket, tryKokoro] : [tryKokoro, tryPocket];
  for (const attempt of order) {
    const audio = await attempt();
    if (audio) return audio;
  }

  // Never cache silence — a later Kokoro/Pocket success should not be blocked.
  return generateSilentWavBuffer();
}

function pocketCanServe(langCode) {
  const pocketLang = POCKET_LANG_MAP[langCode] || 'english';
  if (!ttsDaemon.skipSpawn()) return false;
  const loaded = ttsDaemon.currentLanguage
    || process.env.POCKET_TTS_DEFAULT_LANGUAGE
    || 'spanish_24l';
  return loaded === pocketLang;
}

async function preCachePronunciation(word, langCode, gender = 'female') {
  try {
    await getPronunciationForWord(word, langCode, gender);
  } catch {
    // fire-and-forget
  }
}

module.exports = {
  VOICE_MAP,
  VOICE_MAP_FEMALE,
  VOICE_MAP_MALE,
  ACCENT_RESTORE_MAP,
  POCKET_LANG_MAP,
  CACHE_VERSION,
  SPEECH_TEMPO,
  LEAD_SILENCE_SEC,
  TRAIL_SILENCE_SEC,
  SUPPORTED_LANGUAGES,
  normalizeVoiceGender,
  resolveVoice,
  normalizeWordForTTS,
  normalizeStreamingWav,
  padWavWithSilence,
  fadeInPcm,
  loudnessNormalizePcm,
  ttsPromptForWord,
  slowWav,
  getPronunciationForWord,
  preCachePronunciation,
  getCachedPronunciation,
  ensureDaemonLanguage,
  pocketCanServe,
  generateSilentWavBuffer,
};
