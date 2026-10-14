/**
 * Map daily-word API `reason` codes to user-facing copy.
 * Never return raw snake_case codes to the UI.
 */
const LEARNING_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
};

function learningLanguageName(code: string | null | undefined): string | null {
  const name = LEARNING_LANGUAGE_NAMES[String(code || "").trim().toLowerCase()];
  return name || null;
}

export function friendlyDailyWordReason(
  reason: string | null | undefined,
  opts?: {
    retryAfterSec?: number | null;
    detectedLanguage?: string | null;
    targetLanguage?: string | null;
  }
): string {
  const r = String(reason || "").trim();
  switch (r) {
    case "invalid_ai_daily_word_response":
      return "Couldn't find a new word in a song right now. Your song library may be exhausted — try again in a minute.";
    case "daily_word_generation_failed":
    case "generation_failed":
      return "Couldn't find a new word in a song right now. Please try again shortly.";
    case "song_already_used":
      return "You've already learned from this song. We'll keep looking for a new one — try a different style or search.";
    case "lyrics_not_found":
    case "deezer_not_found":
    case "lyrics_validation_failed":
    case "lyric_outside_preview":
    case "no_suitable_word":
      return "Couldn't match a song with synced lyrics right now. Try again shortly.";
    case "lyrics_wrong_language": {
      const target = learningLanguageName(opts?.targetLanguage);
      const detected = learningLanguageName(opts?.detectedLanguage);
      if (detected && target) {
        return `This song looks ${detected}. You're learning ${target}, so search for a song sung in ${target}.`;
      }
      if (target) {
        return `This song isn't in ${target}. Harmonix teaches English, Spanish, French, German, Portuguese, and Italian. Search for a song sung in ${target}.`;
      }
      return "That song isn't in your learning language. Search for a song sung in the language you're learning.";
    }
    case "track_required":
    case "track_not_found":
    case "no_preview":
      return "Couldn't open that track. Try another search result.";
    case "stale_preferences":
    case "daily_word_stale_preferences":
      return "Your learning preferences changed — loading a new word…";
    case "ai_rate_limit":
      return "AI is busy (rate limit). Please wait a minute and try again.";
    case "cooldown_active":
      return opts?.retryAfterSec
        ? `Please wait ${opts.retryAfterSec} seconds before requesting another word.`
        : "Please wait a moment before requesting another word.";
    case "batch_in_progress":
      return "Still generating your word — please wait a moment.";
    default:
      if (r.includes("429")) {
        return "AI is busy (rate limit). Please wait a minute and try again.";
      }
      return "Couldn't load a new word right now. Please try again.";
  }
}
