/** Account voice used as a pronunciation cache key. The server still reads the saved gender. */
export function normalizePronounceVoice(value?: string | null): "female" | "male" {
  return value === "male" ? "male" : "female";
}

export function pronunciationClipKey(word: string, gender?: string | null): string {
  return `${normalizePronounceVoice(gender)}::${word.trim()}`;
}

export function pronouncePath(word: string, lang: string, gender?: string | null): string {
  const params = new URLSearchParams({
    word,
    lang,
    voice: normalizePronounceVoice(gender),
  });
  return `/daily-word/pronounce?${params.toString()}`;
}
