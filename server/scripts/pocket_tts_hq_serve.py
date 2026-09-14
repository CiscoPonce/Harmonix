#!/usr/bin/env python3
"""High-quality Pocket-TTS HTTP server for Harmonix.

Loads language models with lower temperature and more LSD decode steps than
the default `pocket-tts serve` CLI (temp=0.7, steps=1), which improves
isolated word pronunciation for language learning.

Also exposes POST /reload so the host daemon can swap languages without a
systemd restart (production uses TTS_SKIP_SPAWN).
"""
from __future__ import annotations

import argparse
import sys
import threading


LANG_ALIASES = {
    "en": "english",
    "english": "english",
    "english_2026-04": "english",
    "english_2026-01": "english_2026-01",
    "es": "spanish_24l",
    "spanish": "spanish_24l",
    "spanish_24l": "spanish_24l",
    "fr": "french_24l",
    "french": "french_24l",
    "french_24l": "french_24l",
    "de": "german_24l",
    "german": "german_24l",
    "german_24l": "german_24l",
    "pt": "portuguese_24l",
    "portuguese": "portuguese_24l",
    "portuguese_24l": "portuguese_24l",
    "it": "italian_24l",
    "italian": "italian_24l",
    "italian_24l": "italian_24l",
}

LANG_FAMILY = {
    "english": "english",
    "english_2026-04": "english",
    "english_2026-01": "english",
    "spanish_24l": "spanish",
    "spanish": "spanish",
    "french_24l": "french",
    "german_24l": "german",
    "german": "german",
    "portuguese_24l": "portuguese",
    "portuguese": "portuguese",
    "italian_24l": "italian",
    "italian": "italian",
}


def canonicalize_language(raw: str) -> str:
    key = str(raw or "").strip().lower()
    if key in LANG_ALIASES:
        return LANG_ALIASES[key]
    return key


def language_family(raw: str) -> str:
    canon = canonicalize_language(raw)
    return LANG_FAMILY.get(canon, canon)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3002)
    parser.add_argument("--language", required=True)
    parser.add_argument("--temperature", type=float, default=0.45)
    parser.add_argument("--lsd-decode-steps", type=int, default=3)
    parser.add_argument("--eos-threshold", type=float, default=-3.5)
    args = parser.parse_args()

    import uvicorn
    from fastapi import Form
    from fastapi.responses import JSONResponse
    from pocket_tts.main import web_app
    import pocket_tts.main as pocket_main
    from pocket_tts.models.tts_model import TTSModel

    load_kwargs = {
        "temp": args.temperature,
        "lsd_decode_steps": args.lsd_decode_steps,
        "eos_threshold": args.eos_threshold,
        "quantize": False,
    }
    current_language = canonicalize_language(args.language)
    model_lock = threading.Lock()

    def load_language(language: str) -> str:
        canon = canonicalize_language(language)
        print(
            f"[pocket-tts-hq] loading language={canon} "
            f"temp={args.temperature} lsd_steps={args.lsd_decode_steps} "
            f"eos={args.eos_threshold}",
            flush=True,
        )
        pocket_main.tts_model = TTSModel.load_model(language=canon, **load_kwargs)
        print("[pocket-tts-hq] model ready", flush=True)
        return canon

    current_language = load_language(current_language)

    # Replace the stock /health payload with the loaded language.
    web_app.router.routes = [
        route
        for route in web_app.router.routes
        if getattr(route, "path", None) != "/health"
    ]

    @web_app.get("/health")
    async def health():
        return {
            "status": "ok",
            "language": current_language,
            "family": language_family(current_language),
        }

    @web_app.post("/reload")
    def reload(language: str = Form(...)):
        nonlocal current_language
        requested = canonicalize_language(language)
        if not requested:
            return JSONResponse({"error": "language required"}, status_code=400)
        with model_lock:
            if language_family(current_language) == language_family(requested):
                current_language = requested if current_language == requested else current_language
                return {
                    "status": "ok",
                    "language": current_language,
                    "family": language_family(current_language),
                    "reloaded": False,
                }
            try:
                current_language = load_language(requested)
            except Exception as err:
                print(f"[pocket-tts-hq] reload failed: {err}", flush=True)
                return JSONResponse(
                    {
                        "error": "reload_failed",
                        "message": str(err),
                        "language": current_language,
                    },
                    status_code=500,
                )
        return {
            "status": "ok",
            "language": current_language,
            "family": language_family(current_language),
            "reloaded": True,
        }

    uvicorn.run(web_app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
