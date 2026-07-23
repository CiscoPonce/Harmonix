const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

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

const ttsDaemon = {
  _process: null,
  _ready: false,
  currentLanguage: null,

  start(language) {
    if (this._process) return;

    this.currentLanguage = language;

    // Docker/Coolify: TTS runs on the host (or another container). Don't spawn.
    if (process.env.TTS_SKIP_SPAWN === "true" || process.env.TTS_SKIP_SPAWN === "1") {
      console.log(`[ttsDaemon] TTS_SKIP_SPAWN set — using ${ttsBaseUrl()}`);
      this._ready = false;
      return;
    }

    this._ready = false;

    const python = resolvePython();
    const hqScript = resolveHqScript();
    const env = {
      ...process.env,
      PATH: `/home/ubuntu/.local/bin:/home/ubuntu/pocket-tts/.venv/bin:${process.env.PATH || ""}`,
    };
    const bindHost = process.env.TTS_BIND_HOST || "127.0.0.1";
    const bindPort = process.env.TTS_PORT || "3002";

    if (hqScript) {
      console.log(
        `[ttsDaemon] starting HQ server language=${language} via ${hqScript}`
      );
      this._process = spawn(
        python,
        [
          hqScript,
          "--host", bindHost,
          "--port", bindPort,
          "--language", language,
          "--temperature", process.env.POCKET_TTS_TEMPERATURE || "0.45",
          "--lsd-decode-steps", process.env.POCKET_TTS_LSD_STEPS || "5",
          "--eos-threshold", process.env.POCKET_TTS_EOS || "-3.5",
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
    return new Promise((resolve) => {
      if (!this._process) return resolve();

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
    await this.stop();
    await new Promise((r) => setTimeout(r, 800));
    this.start(language);
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
