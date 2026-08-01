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

def ensure_model_files(model_dir):
    os.makedirs(model_dir, exist_ok=True)
    onnx_path = os.path.join(model_dir, "kokoro-v1.0.onnx")
    voices_path = os.path.join(model_dir, "voices-v1.0.bin")

    if not os.path.exists(onnx_path):
        import urllib.request
        url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
        urllib.request.urlretrieve(url, onnx_path)

    if not os.path.exists(voices_path):
        import urllib.request
        url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
        urllib.request.urlretrieve(url, voices_path)

    return onnx_path, voices_path

def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    word = sys.argv[1]
    lang = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"

    model_dir = os.getenv("KOKORO_MODEL_DIR")
    if not model_dir or not os.path.exists(model_dir):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_dir = os.path.join(base_dir, "models", "kokoro")

    onnx_path, voices_path = ensure_model_files(model_dir)

    from kokoro_onnx import Kokoro
    kokoro = Kokoro(onnx_path, voices_path)

    samples, sample_rate = kokoro.create(word, voice=voice, speed=1.0, lang=lang)
    trimmed = trim_pcm_silence(samples)
    phonemes = ""
    try:
        phonemes = kokoro.tokenizer.phonemize(word, lang)
    except Exception:
        pass

    if "--json" in sys.argv:
        import base64
        import json
        buf = io.BytesIO()
        sf.write(buf, trimmed, sample_rate, format="WAV", subtype="PCM_16")
        wav_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        print(json.dumps({"phonemes": phonemes, "wav": wav_b64, "sampleRate": sample_rate}))
        return

    buf = io.BytesIO()
    sf.write(buf, trimmed, sample_rate, format="WAV", subtype="PCM_16")
    sys.stdout.buffer.write(buf.getvalue())
    sys.stdout.buffer.flush()

if __name__ == "__main__":
    main()
