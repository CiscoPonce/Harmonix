const fs = require('fs');
const path = require('path');
const https = require('https');

let Kokoro = null;
let kokoroInstance = null;
let isInitializing = false;

const KOKORO_LANG_MAP = {
  it: 'it',
  es: 'es',
  fr: 'fr-fr',
  pt: 'pt-br',
  en: 'en-us',
  de: 'en-us', // fallback for German if de voice pack is not built-in
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

function getModelDir() {
  const customPath = process.env.KOKORO_MODEL_DIR;
  if (customPath && fs.existsSync(customPath)) return customPath;
  return path.join(__dirname, '../models/kokoro');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function ensureModelFiles() {
  const dir = getModelDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const onnxPath = path.join(dir, 'kokoro-v1.0.onnx');
  const voicesPath = path.join(dir, 'voices-v1.0.bin');

  if (!fs.existsSync(onnxPath)) {
    console.log('[kokoroService] Downloading kokoro-v1.0.onnx (82MB)...');
    await downloadFile(
      'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
      onnxPath
    );
  }

  if (!fs.existsSync(voicesPath)) {
    console.log('[kokoroService] Downloading voices-v1.0.bin...');
    await downloadFile(
      'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
      voicesPath
    );
  }

  return { onnxPath, voicesPath };
}

async function initKokoro() {
  if (kokoroInstance) return kokoroInstance;
  if (isInitializing) return null;
  isInitializing = true;

  try {
    const { kokoro_onnx } = require('kokoro-onnx') || {};
    const KokoroClass = require('kokoro-onnx').Kokoro;
    if (!KokoroClass) throw new Error('kokoro-onnx package not available');

    const { onnxPath, voicesPath } = await ensureModelFiles();
    kokoroInstance = new KokoroClass(onnxPath, voicesPath);
    console.log('[kokoroService] Kokoro ONNX engine initialized successfully');
    return kokoroInstance;
  } catch (err) {
    console.warn('[kokoroService] Failed to initialize Kokoro ONNX:', err.message || err);
    return null;
  } finally {
    isInitializing = false;
  }
}

async function generateKokoroAudio(word, langCode = 'es', gender = 'female') {
  try {
    const engine = await initKokoro();
    if (!engine) return null;

    const kokoroLang = KOKORO_LANG_MAP[langCode] || 'es';
    const voiceMap = gender === 'male' ? KOKORO_VOICES_MALE : KOKORO_VOICES_FEMALE;
    const voice = voiceMap[langCode] || voiceMap.es;

    const result = await engine.create(word, {
      voice: voice,
      speed: 1.0,
      lang: kokoroLang,
    });

    if (!result || !result.audio) return null;
    return result;
  } catch (err) {
    console.warn(`[kokoroService] Kokoro synthesis failed for '${word}' [${langCode}]:`, err.message || err);
    return null;
  }
}

module.exports = {
  initKokoro,
  generateKokoroAudio,
  KOKORO_LANG_MAP,
  KOKORO_VOICES_FEMALE,
  KOKORO_VOICES_MALE,
};
