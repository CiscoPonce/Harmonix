import type { DailyWordPayload } from '@/lib/dailyWordPayload';

export type RecentWordSummary = {
  id?: number | null;
  date?: string | null;
  word: {
    text: string;
    translation?: string | null;
    pronunciation?: string | null;
    part_of_speech?: string | null;
  };
  title?: string | null;
  phrase?: string | null;
  lyric?: {
    snippet?: string;
    timestamp?: string;
    timestamp_ms?: number | null;
    line_end_ms?: number | null;
    char_start?: number;
    char_end?: number;
    in_preview?: boolean | null;
  } | null;
  song: {
    id: string;
    title: string;
    artist: string;
    cover?: string | null;
  } | null;
  audio?: {
    preview_url?: string;
    duration_seconds?: number | null;
    preview_offset?: number | null;
    preview_provider?: string | null;
  } | null;
};

/** Map `/daily-word/recent` or `/saved/:id` rows into the card payload shape. */
export function recentSummaryToDailyPayload(
  item: RecentWordSummary
): DailyWordPayload | null {
  if (!item?.word?.text?.trim() || !item.song?.id) return null;

  const lyric = item.lyric ?? {};
  const snippet = (lyric.snippet || item.phrase || '').trim();
  const audio = item.audio ?? {};

  return {
    date: item.date || new Date().toISOString().slice(0, 10),
    word: {
      text: item.word.text,
      translation: item.word.translation || '',
      part_of_speech: item.word.part_of_speech ?? null,
      pronunciation: item.word.pronunciation ?? null,
    },
    lyric: {
      snippet,
      timestamp: lyric.timestamp || '',
      timestamp_ms: lyric.timestamp_ms ?? 0,
      line_end_ms: lyric.line_end_ms ?? null,
      line_index: 0,
      char_start: lyric.char_start ?? 0,
      char_end: lyric.char_end ?? 0,
      in_preview: lyric.in_preview ?? null,
    },
    song: {
      id: String(item.song.id),
      title: item.song.title,
      artist: item.song.artist,
      cover: item.song.cover ?? null,
    },
    audio: {
      preview_url: audio.preview_url || '',
      duration_seconds: audio.duration_seconds ?? 30,
      preview_offset: audio.preview_offset ?? 30,
      preview_provider: audio.preview_provider ?? null,
    },
  };
}
