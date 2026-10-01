const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Kokoro-82M has no German model. Never map `de` to English — that made
// first-tap German words speak with af_heart / am_adam.
const KOKORO_LANG_MAP = {
  it: 'it',
  es: 'es',
  fr: 'fr-fr',
  pt: 'pt-br',
  en: 'en-us',
};

const KOKORO_VOICES_FEMALE = {
  it: 'if_sara',
  es: 'ef_dora',
  fr: 'ff_siwis',
  pt: 'pf_dora',
  en: 'af_heart',
};

const KOKORO_VOICES_MALE = {
  it: 'im_nicola',
  es: 'em_alex',
  fr: 'fm_denis',
  pt: 'pm_alex',
  en: 'am_adam',
};

function kokoroSupportsLanguage(langCode) {
  return Boolean(KOKORO_LANG_MAP[langCode]);
}

function resolvePython() {
  const candidates = [
    process.env.POCKET_TTS_PYTHON,
    '/app/venv/bin/python',
    path.join(__dirname, '../venv/bin/python'),
    '/home/ubuntu/pocket-tts/.venv/bin/python',
    path.join(__dirname, '../../../pocket-tts/.venv/bin/python'),
    'python3',
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === 'python3') return c;
    if (fs.existsSync(c)) return c;
  }
  return 'python3';
}

function resolveKokoroScript() {
  const candidates = [
    path.join(__dirname, '../scripts/kokoro_synth.py'),
    '/home/ubuntu/lyric/server/scripts/kokoro_synth.py',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// The production API image has no Python, so every Kokoro call used to spawn,
// fail with ENOENT, and only then fall through to Pocket-TTS. Remember that the
// runtime is missing and skip the spawn for a while.
const UNAVAILABLE_RECHECK_MS = parseInt(process.env.KOKORO_UNAVAILABLE_RECHECK_MS || '600000', 10);
const HTTP_UNAVAILABLE_MS = parseInt(process.env.KOKORO_HTTP_UNAVAILABLE_MS || '20000', 10);
let unavailableUntil = 0;

function kokoroBaseUrl() {
  return (process.env.KOKORO_BASE_URL || '').trim().replace(/\/$/, '');
}

function isKokoroUnavailable() {
  if (process.env.KOKORO_DISABLED === 'true') return true;
  return Date.now() < unavailableUntil;
}

function markKokoroUnavailable(reason, waitMs) {
  if (Date.now() < unavailableUntil) return;
  const wait = Number.isFinite(waitMs) ? waitMs : UNAVAILABLE_RECHECK_MS;
  unavailableUntil = Date.now() + wait;
  console.warn(`[kokoroService] unavailable (${reason}); skipping for ${Math.round(wait / 1000)}s`);
}

function __resetKokoroAvailabilityForTest() {
  unavailableUntil = 0;
}

function voiceFor(langCode, gender) {
  const voiceMap = gender === 'male' ? KOKORO_VOICES_MALE : KOKORO_VOICES_FEMALE;
  return voiceMap[langCode] || null;
}

function wavFromResponse(bytes) {
  const wavBuffer = Buffer.from(bytes);
  if (!wavBuffer || wavBuffer.length < 44 || wavBuffer.slice(0, 4).toString() !== 'RIFF') {
    return null;
  }
  return wavBuffer;
}

async function generateKokoroAudioViaHttp(text, langCode, gender) {
  const base = kokoroBaseUrl();
  const kokoroLang = KOKORO_LANG_MAP[langCode];
  const voice = voiceFor(langCode, gender);
  if (!base || !kokoroLang || !voice) return null;
  const res = await fetch(`${base}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang: kokoroLang, voice, gender }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  return wavFromResponse(await res.arrayBuffer());
}

function generateKokoroAudio(word, langCode = 'es', gender = 'female') {
  if (!kokoroSupportsLanguage(langCode)) return Promise.resolve(null);
  if (isKokoroUnavailable()) return Promise.resolve(null);
  if (kokoroBaseUrl()) {
    return generateKokoroAudioViaHttp(word, langCode, gender)
      .then((wavBuffer) => {
        if (!wavBuffer) {
          markKokoroUnavailable('kokoro http failed', HTTP_UNAVAILABLE_MS);
          return null;
        }
        return { audio: wavBuffer, phonemes: null, sampleRate: 24000 };
      })
      .catch((err) => {
        markKokoroUnavailable(err?.message || 'kokoro http error', HTTP_UNAVAILABLE_MS);
        return null;
      });
  }
  return new Promise((resolve) => {
    const pythonBin = resolvePython();
    const scriptPath = resolveKokoroScript();
    if (!scriptPath) {
      markKokoroUnavailable('kokoro_synth.py not found');
      return resolve(null);
    }

    const kokoroLang = KOKORO_LANG_MAP[langCode];
    const voice = voiceFor(langCode, gender);
    if (!voice) return resolve(null);

    execFile(
      pythonBin,
      [scriptPath, word, kokoroLang, voice, '--json'],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 8000 },
      (err, stdout, stderr) => {
        if (err || !stdout) {
          console.warn(`[kokoroService] Synthesis error for '${word}':`, err?.message || err, stderr ? `stderr: ${stderr}` : '');
          if (err?.code === 'ENOENT' || /No module named|ModuleNotFoundError/.test(String(stderr || ''))) {
            markKokoroUnavailable(err?.code === 'ENOENT' ? `${pythonBin} missing` : 'kokoro python deps missing');
          }
          return resolve(null);
        }
        try {
          const data = JSON.parse(stdout);
          const wavBuffer = Buffer.from(data.wav, 'base64');
          if (!wavBuffer || wavBuffer.length < 44 || wavBuffer.slice(0, 4).toString() !== 'RIFF') {
            return resolve(null);
          }
          resolve({ audio: wavBuffer, phonemes: data.phonemes || null, sampleRate: data.sampleRate || 24000 });
        } catch {
          resolve(null);
        }
      }
    );
  });
}

module.exports = {
  generateKokoroAudio,
  kokoroSupportsLanguage,
  kokoroBaseUrl,
  isKokoroUnavailable,
  markKokoroUnavailable,
  __resetKokoroAvailabilityForTest,
  resolvePython,
  KOKORO_LANG_MAP,
  KOKORO_VOICES_FEMALE,
  KOKORO_VOICES_MALE,
};
