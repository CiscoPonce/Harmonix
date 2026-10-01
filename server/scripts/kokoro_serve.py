#!/usr/bin/env python3
"""Host Kokoro HTTP server for Harmonix.

Speaks one short prompt in the requested language and voice. A failed
synthesis returns 500. It never substitutes an English voice.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf

from kokoro_synth import ensure_model_files, trim_pcm_silence

MAX_CHARS = 80
VOICES = {
    "es": {"female": "ef_dora", "male": "em_alex"},
    "en-us": {"female": "af_heart", "male": "am_adam"},
    "fr-fr": {"female": "ff_siwis", "male": "fm_denis"},
    "pt-br": {"female": "pf_dora", "male": "pm_alex"},
    "it": {"female": "if_sara", "male": "im_nicola"},
}

_kokoro = None
_lock = threading.Lock()


def load_model():
    global _kokoro
    from kokoro_onnx import Kokoro

    onnx_path, voices_path = ensure_model_files(model_dir_from_env())
    _kokoro = Kokoro(onnx_path, voices_path)


def model_dir_from_env():
    import os

    model_dir = os.getenv("KOKORO_MODEL_DIR")
    if model_dir:
        return model_dir
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "models", "kokoro")


def resolve_voice(lang: str, voice: str | None, gender: str | None) -> str | None:
    table = VOICES.get(lang)
    if not table:
        return None
    if voice and voice in table.values():
        return voice
    gender_key = "male" if gender == "male" else "female"
    return table[gender_key]


def synthesize(text: str, lang: str, voice: str) -> tuple[np.ndarray, int]:
    if _kokoro is None:
        raise RuntimeError("kokoro model is not loaded")
    with _lock:
        samples, sample_rate = _kokoro.create(text, voice=voice, speed=1.0, lang=lang)
    trimmed = trim_pcm_silence(np.asarray(samples, dtype=np.float32))
    return trimmed, int(sample_rate)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("[kokoro] " + (fmt % args) + "\n")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 4096:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def do_GET(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/health":
            self._json(404, {"error": "not_found"})
            return
        self._json(200, {"status": "ok", "engine": "kokoro", "voices": "es:ef_dora,em_alex"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/tts":
            self._json(404, {"error": "not_found"})
            return
        data = self._read_json()
        text = str(data.get("text") or "").strip()
        lang = str(data.get("lang") or "").strip()
        voice = resolve_voice(lang, data.get("voice"), data.get("gender"))
        if not text or len(text) > MAX_CHARS or not voice:
            self._json(400, {"error": "bad_request"})
            return
        try:
            samples, sample_rate = synthesize(text, lang, voice)
        except Exception as err:
            self._json(500, {"error": "synthesis_failed", "detail": str(err)[:180]})
            return
        import io

        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="WAV", subtype="PCM_16")
        wav = buf.getvalue()
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.end_headers()
        self.wfile.write(wav)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3003)
    args = parser.parse_args()
    load_model()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[kokoro] listening on {args.host}:{args.port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
