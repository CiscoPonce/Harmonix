import os
import sys
import time
import torch
import soundfile as sf

out_dir = "/home/cisco/Documents/Oracle server/lyrics/server/scratch/audio_comparison"
os.makedirs(out_dir, exist_ok=True)

test_words = [
    {"word": "perché", "lang": "it"},
    {"word": "sempre", "lang": "it"},
    {"word": "toujours", "lang": "fr"},
    {"word": "también", "lang": "es"},
    {"word": "obrigado", "lang": "pt"},
    {"word": "zusammen", "lang": "de"},
]

print("=== Starting Audio8_TTS vs Pocket-TTS Comparison ===")
print("Output Directory:", out_dir)

try:
    from transformers import AutoModel, AutoProcessor
    model_id = "AutoArk-AI/Audio8-TTS-Preview-0.6b"
    print(f"Loading Audio8 model: {model_id}...")
    processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
    model = AutoModel.from_pretrained(model_id, trust_remote_code=True).eval()
    print("Audio8 Model loaded successfully!")

    for item in test_words[:2]:
        w = item["word"]
        lang = item["lang"]
        print(f"Generating Audio8 TTS for [{lang}]: '{w}'...", flush=True)
        t0 = time.time()
        try:
            inputs = processor(text=w, return_tensors="pt")
            with torch.no_grad():
                out = model.generate(**inputs, max_new_tokens=250)
            dt = (time.time() - t0) * 1000
            
            filepath = os.path.join(out_dir, f"audio8_{lang}_{w}.wav")
            audio_arr = out.detach().cpu().to(torch.float32).numpy().squeeze()
            if audio_arr.ndim > 1:
                audio_arr = audio_arr[0]
            # Normalize to [-1.0, 1.0] if range exceeds 1.0
            max_val = abs(audio_arr).max()
            if max_val > 1.0:
                audio_arr = audio_arr / max_val
            sf.write(filepath, audio_arr, 44100)
            print(f" -> SUCCESS Audio8 clip: {filepath} ({dt:.1f}ms, 44.1kHz)", flush=True)
        except Exception as err:
            print(f" -> ERROR generating '{w}': {err}", flush=True)
            import traceback
            traceback.print_exc()

except Exception as e:
    print(f"Audio8_TTS test error: {e}", flush=True)
    import traceback
    traceback.print_exc()
