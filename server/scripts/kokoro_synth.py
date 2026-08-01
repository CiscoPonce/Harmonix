#!/usr/bin/env python3
import os
import sys
import numpy as np
import soundfile as sf
import io

def trim_pcm_silence(samples, threshold=0.005, min_pad=240):
    abs_samples = np.abs(samples)
    mask = abs_samples > threshold
    if not np.any(mask):
        return samples
    start = max(0, np.argmax(mask) - min_pad)
    end = min(len(samples), len(samples) - np.argmax(mask[::-1]) + min_pad)
    return samples[start:end]

def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    word = sys.argv[1]
    lang = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"

    model_dir = "/home/cisco/Documents/Oracle server/lyrics/server/models/kokoro"
    onnx_path = os.path.join(model_dir, "kokoro-v1.0.onnx")
    voices_path = os.path.join(model_dir, "voices-v1.0.bin")

    if not os.path.exists(onnx_path) or not os.path.exists(voices_path):
        sys.exit(1)

    from kokoro_onnx import Kokoro
    kokoro = Kokoro(onnx_path, voices_path)

    samples, sample_rate = kokoro.create(word, voice=voice, speed=1.0, lang=lang)
    trimmed = trim_pcm_silence(samples)

    buf = io.BytesIO()
    sf.write(buf, trimmed, sample_rate, format="WAV", subtype="PCM_16")
    sys.stdout.buffer.write(buf.getvalue())
    sys.stdout.buffer.flush()

if __name__ == "__main__":
    main()
