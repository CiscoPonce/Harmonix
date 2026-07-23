#!/usr/bin/env python3
"""High-quality Pocket-TTS HTTP server for Harmonix.

Loads language models with lower temperature and more LSD decode steps than
the default `pocket-tts serve` CLI (temp=0.7, steps=1), which improves
isolated word pronunciation for language learning.
"""
from __future__ import annotations

import argparse
import sys


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
    from pocket_tts.main import web_app
    import pocket_tts.main as pocket_main
    from pocket_tts.models.tts_model import TTSModel

    print(
        f"[pocket-tts-hq] loading language={args.language} "
        f"temp={args.temperature} lsd_steps={args.lsd_decode_steps} "
        f"eos={args.eos_threshold}",
        flush=True,
    )
    pocket_main.tts_model = TTSModel.load_model(
        language=args.language,
        temp=args.temperature,
        lsd_decode_steps=args.lsd_decode_steps,
        eos_threshold=args.eos_threshold,
        quantize=False,
    )
    print("[pocket-tts-hq] model ready", flush=True)
    uvicorn.run(web_app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
