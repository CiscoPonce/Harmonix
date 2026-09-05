const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const KOKORO_LANG_MAP = {
  it: 'it',
  es: 'es',
  fr: 'fr-fr',
  pt: 'pt-br',
  en: 'en-us',
  de: 'en-us',
};

const KOKORO_VOICES_FEMALE = {
  it: 'if_sara',
  es: 'ef_dora',
  fr: 'ff_siwis',
  pt: 'pf_dora',
  en: 'af_heart',
  de: 'af_heart',
};

const KOKORO_VOICES_MALE = {
  it: 'im_nicola',
  es: 'em_alex',
  fr: 'fm_denis',
  pt: 'pm_alex',
  en: 'am_adam',
  de: 'am_adam',
};

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
let unavailableUntil = 0;

function isKokoroUnavailable() {
  if (process.env.KOKORO_DISABLED === 'true') return true;
  return Date.now() < unavailableUntil;
}

function markKokoroUnavailable(reason) {
  if (Date.now() < unavailableUntil) return;
  unavailableUntil = Date.now() + UNAVAILABLE_RECHECK_MS;
  console.warn(`[kokoroService] unavailable (${reason}); skipping for ${Math.round(UNAVAILABLE_RECHECK_MS / 1000)}s`);
}

function __resetKokoroAvailabilityForTest() {
  unavailableUntil = 0;
}

function generateKokoroAudio(word, langCode = 'es', gender = 'female') {
  return new Promise((resolve) => {
    if (isKokoroUnavailable()) return resolve(null);
    const pythonBin = resolvePython();
    const scriptPath = resolveKokoroScript();
    if (!scriptPath) {
      markKokoroUnavailable('kokoro_synth.py not found');
      return resolve(null);
    }

    const kokoroLang = KOKORO_LANG_MAP[langCode] || 'es';
    const voiceMap = gender === 'male' ? KOKORO_VOICES_MALE : KOKORO_VOICES_FEMALE;
    const voice = voiceMap[langCode] || voiceMap.es;

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
  isKokoroUnavailable,
  markKokoroUnavailable,
  __resetKokoroAvailabilityForTest,
  resolvePython,
  KOKORO_LANG_MAP,
  KOKORO_VOICES_FEMALE,
  KOKORO_VOICES_MALE,
};
