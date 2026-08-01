import os
import sys
import time
import soundfile as sf
import urllib.request
from kokoro_onnx import Kokoro

model_dir = "/home/cisco/Documents/Oracle server/lyrics/server/models/kokoro"
os.makedirs(model_dir, exist_ok=True)

onnx_path = os.path.join(model_dir, "kokoro-v1.0.onnx")
voices_path = os.path.join(model_dir, "voices-v1.0.bin")

if not os.path.exists(onnx_path):
    print("Downloading kokoro-v1.0.onnx...", flush=True)
    urllib.request.urlretrieve(
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
        onnx_path
    )

if not os.path.exists(voices_path):
    print("Downloading voices-v1.0.bin...", flush=True)
    urllib.request.urlretrieve(
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
        voices_path
    )

print("=== Testing kokoro-onnx ARM-Optimized Engine ===", flush=True)
t0 = time.time()
kokoro = Kokoro(onnx_path, voices_path)
print(f"Kokoro ONNX Engine loaded in {(time.time() - t0)*1000:.1f}ms", flush=True)

test_items = [
    {"word": "perché", "lang": "it", "voice": "if_sara", "code": "it"},
    {"word": "sempre", "lang": "it", "voice": "if_sara", "code": "it"},
    {"word": "toujours", "lang": "fr-fr", "voice": "ff_siwis", "code": "fr"},
    {"word": "también", "lang": "es", "voice": "ef_dora", "code": "es"},
    {"word": "obrigado", "lang": "pt-br", "voice": "pf_dora", "code": "pt"},
    {"word": "harmonix", "lang": "en-us", "voice": "af_heart", "code": "en"},
]

out_dir = "/home/cisco/Documents/Oracle server/lyrics/server/scratch/audio_comparison"
os.makedirs(out_dir, exist_ok=True)

for item in test_items:
    word = item["word"]
    lang = item["lang"]
    voice = item["voice"]
    code = item["code"]
    
    t_start = time.time()
    try:
        samples, sample_rate = kokoro.create(word, voice=voice, speed=1.0, lang=lang)
        dt = (time.time() - t_start) * 1000
        filepath = os.path.join(out_dir, f"kokoro_onnx_{code}_{word}.wav")
        sf.write(filepath, samples, sample_rate)
        print(f" -> SUCCESS ONNX [{code}] '{word}': {filepath} ({dt:.1f}ms, {sample_rate}Hz)", flush=True)
    except Exception as e:
        print(f" -> ERROR ONNX [{code}] '{word}': {e}", flush=True)
