const { spawn } = require('child_process');

const ttsDaemon = {
  _process: null,
  _ready: false,
  currentLanguage: null,

  start(language) {
    if (this._process) return;

    this.currentLanguage = language;
    this._ready = false;

    this._process = spawn('pocket-tts', [
      'serve', '--host', '127.0.0.1', '--port', '3002',
      '--language', language,
    ], { stdio: 'pipe' });

    this._process.on('error', () => {
      this._process = null;
      this._ready = false;
    });

    this._process.stderr?.on('data', (d) => {
      const s = d.toString();
      if (s.includes('Application startup complete') || s.includes('Uvicorn running')) {
        this._ready = true;
      }
    });

    this._process.on('exit', () => {
      this._process = null;
      this._ready = false;
    });
  },

  stop() {
    return new Promise((resolve) => {
      if (!this._process) return resolve();

      const proc = this._process;
      this._ready = false;

      const killTimeout = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
      }, 3000);

      proc.on('exit', () => {
        clearTimeout(killTimeout);
        this._process = null;
        resolve();
      });

      try { proc.kill('SIGTERM'); } catch {
        clearTimeout(killTimeout);
        this._process = null;
        resolve();
      }
    });
  },

  async restart(language) {
    await this.stop();
    this.start(language);
  },

  async healthCheck() {
    try {
      const res = await fetch('http://127.0.0.1:3002/health');
      return res.ok;
    } catch {
      return false;
    }
  },
};

module.exports = ttsDaemon;
