const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function ttsBaseUrl() {
  const fromEnv = (process.env.TTS_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = (process.env.POCKET_TTS_HOST || "127.0.0.1").trim();
  const port = process.env.TTS_PORT || "3002";
  return `http://${host}:${port}`;
}

function resolvePython() {
  const candidates = [
    process.env.POCKET_TTS_PYTHON,
    path.join(__dirname, "../venv/bin/python"),
    "/home/ubuntu/pocket-tts/.venv/bin/python",
    path.join(__dirname, "../../../pocket-tts/.venv/bin/python"),
    "python3",
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === "python3") return c;
    if (fs.existsSync(c)) return c;
  }
  return "python3";
}

function resolveHqScript() {
  const candidates = [
    process.env.POCKET_TTS_HQ_SCRIPT,
    path.join(__dirname, "../scripts/pocket_tts_hq_serve.py"),
    "/home/ubuntu/lyric/server/scripts/pocket_tts_hq_serve.py",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function resolvePocketTtsBin() {
  const candidates = [
    process.env.POCKET_TTS_BIN,
    "/home/ubuntu/.local/bin/pocket-tts",
    "/home/ubuntu/pocket-tts/.venv/bin/pocket-tts",
    "pocket-tts",
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === "pocket-tts") return c;
    if (fs.existsSync(c)) return c;
  }
  return "pocket-tts";
}

function skipSpawn() {
  return process.env.TTS_SKIP_SPAWN === "true" || process.env.TTS_SKIP_SPAWN === "1";
}

function freeTtsPort(port) {
  if (skipSpawn()) return;
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    /* fuser missing or nothing listening */
  }
  try {
    execSync(`pkill -f 'pocket_tts_hq_serve.py'`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  try {
    execSync(`pkill -f 'pocket-tts serve'`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
}

const ttsDaemon = {
  _process: null,
  _ready: false,
  currentLanguage: null,
  skipSpawn,

  start(language) {
    if (this._process) return;

    this.currentLanguage = language;

    // Docker/Coolify: TTS runs on the host (or another container). Don't spawn.
    if (skipSpawn()) {
      console.log(`[ttsDaemon] TTS_SKIP_SPAWN set — using ${ttsBaseUrl()}`);
      this._ready = false;
      return;
    }

    // Adopt an already-healthy daemon (e.g. previous API process left it up).
    // Avoids a multi-second model reload on every API restart.
    this._ready = false;
    fetch(`${ttsBaseUrl()}/health`)
      .then(async (res) => {
        if (res.ok) {
          this._ready = true;
          console.log(
            `[ttsDaemon] adopting healthy daemon at ${ttsBaseUrl()} language=${language}`
          );
        }
      })
      .catch(() => {});

    // If something is already listening, don't spawn a second copy.
    // (Adoption path above; spawn only when health fails after a short wait.)
    setTimeout(() => {
      if (this._ready || this._process) return;
      this._spawn(language);
    }, 150);
  },

  _spawn(language) {
    if (skipSpawn()) return;
    if (this._process || this._ready) return;

    const python = resolvePython();
    const hqScript = resolveHqScript();
    const env = {
      ...process.env,
      PATH: `/home/ubuntu/.local/bin:/home/ubuntu/pocket-tts/.venv/bin:${process.env.PATH || ""}`,
    };
    const bindHost = process.env.TTS_BIND_HOST || "127.0.0.1";
    const bindPort = process.env.TTS_PORT || "3002";
    // Lower LSD steps = faster cold synthesize (quality still good for words).
    const lsdSteps = process.env.POCKET_TTS_LSD_STEPS || "3";
    const temperature = process.env.POCKET_TTS_TEMPERATURE || "0.45";
    const eos = process.env.POCKET_TTS_EOS || "-3.5";

    freeTtsPort(bindPort);

    if (hqScript) {
      console.log(
        `[ttsDaemon] starting HQ server language=${language} via ${hqScript} lsd=${lsdSteps}`
      );
      this._process = spawn(
        python,
        [
          hqScript,
          "--host", bindHost,
          "--port", bindPort,
          "--language", language,
          "--temperature", temperature,
          "--lsd-decode-steps", lsdSteps,
          "--eos-threshold", eos,
        ],
        { stdio: "pipe", env }
      );
    } else {
      const bin = resolvePocketTtsBin();
      console.log(`[ttsDaemon] HQ script missing; falling back to ${bin} serve`);
      this._process = spawn(
        bin,
        ["serve", "--host", bindHost, "--port", bindPort, "--language", language],
        { stdio: "pipe", env }
      );
    }

    this._process.on("error", (err) => {
      console.error(`[ttsDaemon] spawn error: ${err.message}`);
      this._process = null;
      this._ready = false;
    });

    const onData = (d) => {
      const s = d.toString();
      if (s.trim()) console.log(`[pocket-tts] ${s.trim()}`);
      if (
        s.includes("Application startup complete")
        || s.includes("Uvicorn running")
        || s.includes("model ready")
      ) {
        this._ready = true;
      }
    };
    this._process.stdout?.on("data", onData);
    this._process.stderr?.on("data", onData);

    this._process.on("exit", (code, signal) => {
      console.warn(`[ttsDaemon] exited code=${code} signal=${signal}`);
      this._process = null;
      this._ready = false;
    });
  },

  stop() {
    if (skipSpawn()) return Promise.resolve();
    return new Promise((resolve) => {
      if (!this._process) {
        freeTtsPort(process.env.TTS_PORT || "3002");
        return resolve();
      }

      const proc = this._process;
      this._ready = false;

      const killTimeout = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
      }, 8000);

      proc.on("exit", () => {
        clearTimeout(killTimeout);
        this._process = null;
        resolve();
      });

      try { proc.kill("SIGTERM"); } catch {
        clearTimeout(killTimeout);
        this._process = null;
        resolve();
      }
    });
  },

  async restart(language) {
    if (skipSpawn()) {
      if (language && this.currentLanguage && language !== this.currentLanguage) {
        const err = new Error(
          `Pocket-TTS language swap disabled (TTS_SKIP_SPAWN); host is ${this.currentLanguage}`
        );
        err.code = "tts_language_mismatch";
        throw err;
      }
      return;
    }
    await this.stop();
    await new Promise((r) => setTimeout(r, 400));
    this.currentLanguage = language;
    this._ready = false;
    this._process = null;
    this._spawn(language);
  },

  async healthCheck() {
    try {
      const res = await fetch(`${ttsBaseUrl()}/health`);
      if (res.ok) {
        this._ready = true;
        return true;
      }
    } catch {}
    return false;
  },

  baseUrl: ttsBaseUrl,
};

module.exports = ttsDaemon;
