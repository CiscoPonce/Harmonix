/**
 * Map daily-word API `reason` codes to user-facing copy.
 * Never return raw snake_case codes to the UI.
 */
export function friendlyDailyWordReason(
  reason: string | null | undefined,
  opts?: { retryAfterSec?: number | null }
): string {
  const r = String(reason || "").trim();
  switch (r) {
    case "invalid_ai_daily_word_response":
      return "Couldn't find a new word in a song right now. Your song library may be exhausted — try again in a minute.";
    case "daily_word_generation_failed":
    case "generation_failed":
      return "Couldn't find a new word in a song right now. Please try again shortly.";
    case "song_already_used":
      return "We're finding a fresh song match — tap New word again in a moment.";
    case "lyrics_not_found":
    case "deezer_not_found":
    case "lyrics_validation_failed":
    case "lyric_outside_preview":
    case "no_suitable_word":
      return "Couldn't match a song with synced lyrics right now. Try again shortly.";
    case "lyrics_wrong_language":
      return "That song isn't in your learning language. Search for a song sung in the language you're learning.";
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
