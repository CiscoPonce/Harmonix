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

function generateKokoroAudio(word, langCode = 'es', gender = 'female') {
  return new Promise((resolve) => {
    const pythonBin = resolvePython();
    const scriptPath = resolveKokoroScript();
    if (!scriptPath) return resolve(null);

    const kokoroLang = KOKORO_LANG_MAP[langCode] || 'es';
    const voiceMap = gender === 'male' ? KOKORO_VOICES_MALE : KOKORO_VOICES_FEMALE;
    const voice = voiceMap[langCode] || voiceMap.es;

    execFile(
      pythonBin,
      [scriptPath, word, kokoroLang, voice],
      { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout || stdout.length < 44) {
          if (err) console.warn(`[kokoroService] Synthesis warning for '${word}':`, err.message || err);
          return resolve(null);
        }
        if (stdout.slice(0, 4).toString() !== 'RIFF') {
          console.warn(`[kokoroService] Invalid WAV header for '${word}'`);
          return resolve(null);
        }
        resolve({ audio: stdout, sampleRate: 24000 });
      }
    );
  });
}

module.exports = {
  generateKokoroAudio,
  resolvePython,
  KOKORO_LANG_MAP,
  KOKORO_VOICES_FEMALE,
  KOKORO_VOICES_MALE,
};
