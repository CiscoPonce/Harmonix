const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
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

const POCKET_LANG_MAP = {
  en: 'english',
  es: 'spanish_24l',
  fr: 'french_24l',
  de: 'german_24l',
  pt: 'portuguese_24l',
  it: 'italian_24l',
};

/** Bump to invalidate SQLite pronunciation cache after quality/speed changes. */
const CACHE_VERSION = 'hq-v5-leadin';

/** Playback tempo (< 1 = slower). Pitch preserved via ffmpeg atempo. */
const SPEECH_TEMPO = Number(process.env.POCKET_TTS_TEMPO || '0.75');

/** Silence before the word (seconds) — softens ffmpeg start click / bump. */
const LEAD_SILENCE_SEC = Number(process.env.POCKET_TTS_LEAD_SILENCE || '0.5');
const TRAIL_SILENCE_SEC = Number(process.env.POCKET_TTS_TRAIL_SILENCE || '0.25');

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

function padWavWithSilence(
  wavBuffer,
  sampleRate = 24000,
  {
    leadSeconds = LEAD_SILENCE_SEC,
    trailSeconds = TRAIL_SILENCE_SEC,
  } = {},
) {
  const clean = normalizeStreamingWav(wavBuffer);
  const pcmData = fadeInPcm(clean.subarray(44), sampleRate, 0.025);
  const lead = Buffer.alloc(Math.round(sampleRate * leadSeconds * 2), 0);
  const trail = Buffer.alloc(Math.round(sampleRate * trailSeconds * 2), 0);
  return buildCleanWav(Buffer.concat([lead, pcmData, trail]), sampleRate);
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

function cacheKey(word) {
  return `${CACHE_VERSION}::${String(word || '').trim()}`;
}

function getCachedPronunciation(word) {
  const row = db.prepare('SELECT audio_blob FROM word_pronunciation_cache WHERE word = ?').get(cacheKey(word));
  return row ? row.audio_blob : undefined;
}

function cachePronunciation(word, audioBlob) {
  db.prepare('INSERT OR IGNORE INTO word_pronunciation_cache (word, audio_blob) VALUES (?, ?)').run(cacheKey(word), audioBlob);
}

function ttsPromptForWord(word) {
  const w = String(word || '').trim();
  if (!w) return w;
  return `${w}.`;
}

/**
 * Slow speech without changing pitch (ffmpeg atempo) on a normalized WAV.
 */
async function slowWav(wavBuffer, tempo = SPEECH_TEMPO) {
  const rate = Math.min(2, Math.max(0.5, Number(tempo) || 0.75));
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
        '-filter:a', `atempo=${rate},afade=t=in:st=0:d=0.03`,
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

async function fetchFromPocketTTS(word, voiceUrl) {
  const params = new URLSearchParams();
  params.append('text', ttsPromptForWord(word));
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

async function ensureDaemonLanguage(langCode) {
  const pocketLang = POCKET_LANG_MAP[langCode] || 'english';
  if (ttsDaemon.currentLanguage === pocketLang && (await ttsDaemon.healthCheck())) {
    return;
  }
  await ttsDaemon.restart(pocketLang);
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await ttsDaemon.healthCheck()) return;
  }
  const err = new Error('Pocket-TTS daemon failed to become ready');
  err.code = 'tts_unavailable';
  throw err;
}

async function getPronunciationForWord(word, langCode) {
  if (!SUPPORTED_LANGUAGES.includes(langCode)) {
    const err = new Error('unsupported_language');
    err.code = 'unsupported_language';
    throw err;
  }

  const cached = getCachedPronunciation(word);
  if (cached) return cached;

  await ensureDaemonLanguage(langCode);

  const wavBuffer = await fetchFromPocketTTS(word, VOICE_MAP[langCode]);
  const slowed = await slowWav(wavBuffer, SPEECH_TEMPO);
  const padded = padWavWithSilence(slowed);
  cachePronunciation(word, padded);
  return padded;
}

async function preCachePronunciation(word, langCode) {
  try {
    await getPronunciationForWord(word, langCode);
  } catch {
    // fire-and-forget
  }
}

module.exports = {
  VOICE_MAP,
  POCKET_LANG_MAP,
  CACHE_VERSION,
  SPEECH_TEMPO,
  LEAD_SILENCE_SEC,
  TRAIL_SILENCE_SEC,
  SUPPORTED_LANGUAGES,
  normalizeStreamingWav,
  padWavWithSilence,
  fadeInPcm,
  ttsPromptForWord,
  slowWav,
  getPronunciationForWord,
  preCachePronunciation,
  getCachedPronunciation,
};
