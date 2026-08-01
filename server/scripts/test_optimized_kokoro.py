import os
import time
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro

model_dir = "/home/cisco/Documents/Oracle server/lyrics/server/models/kokoro"
onnx_path = os.path.join(model_dir, "kokoro-v1.0.onnx")
voices_path = os.path.join(model_dir, "voices-v1.0.bin")

os.environ["OMP_NUM_THREADS"] = "4"
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

def trim_pcm_silence(samples, threshold=0.005, min_pad=240):
    abs_samples = np.abs(samples)
    mask = abs_samples > threshold
    if not np.any(mask):
        return samples
    start = max(0, np.argmax(mask) - min_pad)
    end = min(len(samples), len(samples) - np.argmax(mask[::-1]) + min_pad)
    return samples[start:end]

print("=== Benchmarking ONNX Thread Tuning & Silence Trimming ===", flush=True)

t_init = time.time()
kokoro = Kokoro(onnx_path, voices_path)
print(f"Engine ready in {(time.time() - t_init)*1000:.1f}ms", flush=True)

test_words = [
    ("perché", "it"),
    ("sempre", "it"),
    ("toujours", "fr-fr"),
    ("también", "es"),
    ("obrigado", "pt-br"),
    ("harmonix", "en-us"),
]

times = []
for word, lang in test_words:
    t0 = time.time()
    samples, sample_rate = kokoro.create(word, voice="af_heart", speed=1.0, lang=lang)
    trimmed = trim_pcm_silence(samples)
    dt = (time.time() - t0) * 1000
    times.append(dt)
    print(f" -> [{lang}] '{word}': raw={len(samples)} -> trimmed={len(trimmed)} samples ({dt:.1f}ms)", flush=True)

print(f"=== Average Latency: {np.mean(times):.1f}ms ===", flush=True)
