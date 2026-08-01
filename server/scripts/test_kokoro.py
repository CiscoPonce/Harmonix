import os
import time
import soundfile as sf
from kokoro import KPipeline

out_dir = "/home/cisco/Documents/Oracle server/lyrics/server/scratch/audio_comparison"
os.makedirs(out_dir, exist_ok=True)

test_items = [
    {"word": "perché", "lang": "i", "voice": "if_sara", "code": "it"},
    {"word": "sempre", "lang": "i", "voice": "if_sara", "code": "it"},
    {"word": "toujours", "lang": "f", "voice": "ff_siwis", "code": "fr"},
    {"word": "también", "lang": "e", "voice": "ef_dora", "code": "es"},
    {"word": "obrigado", "lang": "p", "voice": "pf_dora", "code": "pt"},
    {"word": "zusammen", "lang": "d", "voice": "df_dora", "code": "de"},
    {"word": "harmonix", "lang": "a", "voice": "af_heart", "code": "en"},
]

print("=== Starting Kokoro-82M TTS Benchmark ===", flush=True)

for item in test_items:
    word = item["word"]
    lang = item["lang"]
    voice = item["voice"]
    code = item["code"]
    
    print(f"Testing Kokoro [{code}] '{word}' with voice '{voice}'...", flush=True)
    t0 = time.time()
    try:
        pipeline = KPipeline(lang_code=lang)
        generator = pipeline(word, voice=voice, speed=1.0, split_pattern=r'\n+')
        
        for i, (graphemes, phonemes, audio) in enumerate(generator):
            dt = (time.time() - t0) * 1000
            filepath = os.path.join(out_dir, f"kokoro_{code}_{word}.wav")
            sf.write(filepath, audio, 24000)
            print(f" -> SUCCESS Kokoro clip: {filepath} ({dt:.1f}ms, 24kHz, phonemes: '{phonemes}')", flush=True)
    except Exception as e:
        print(f" -> ERROR Kokoro [{code}] '{word}': {e}", flush=True)
