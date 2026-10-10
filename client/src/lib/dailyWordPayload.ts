/** Shared daily-word card shape (home + saved library entries). */
export interface DailyWordPayload {
  date: string;
  cached?: boolean;
  from_queue?: boolean;
  language_code?: string;
  word: {
    text: string;
    translation: string;
    part_of_speech?: string | null;
    pronunciation?: string | null;
    difficulty?: string;
    line_translation?: string | null;
  };
  lyric: {
    snippet: string;
    timestamp: string;
    timestamp_ms: number;
    line_end_ms?: number | null;
    line_index: number;
    char_start: number;
    char_end: number;
    in_preview?: boolean | null;
    line_translation?: string | null;
  };
  song: {
    id: string;
    title: string;
    artist: string;
    genre?: string | null;
    cover?: string | null;
  };
  audio: {
    preview_url: string;
    duration_seconds: number;
    preview_offset: number;
    preview_end?: number;
    preview_provider?: string | null;
  };
  style_relaxed?: boolean;
  style_relaxed_from?: string | null;
  same_song_fallback?: boolean;
  song_repeated?: boolean;
  queue?: {
    ready: number;
    refilling: boolean;
    target: number;
    max: number;
  };
}
