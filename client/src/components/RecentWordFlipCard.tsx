'use client';

import { useState } from 'react';
import { ExternalLink, Music2, RotateCw } from 'lucide-react';
import { spotifyOpenUrlForSong } from '@/lib/spotifyOpen';

export type ShelfWord = {
  id?: number | string | null;
  word: {
    text: string;
    translation: string | null;
    pronunciation?: string | null;
    part_of_speech?: string | null;
  };
  /** Flat aliases from /daily-word/recent */
  title?: string | null;
  phrase?: string | null;
  lyric?: {
    snippet: string;
    timestamp?: string;
    char_start?: number;
    char_end?: number;
  } | null;
  song: { id: string; title: string; artist: string } | null;
};

function highlightWord(snippet: string, start?: number, end?: number) {
  if (!snippet) return null;
  const s = typeof start === 'number' ? start : 0;
  const e = typeof end === 'number' ? end : s;
  const safeStart = Math.max(0, Math.min(s, snippet.length));
  const safeEnd = Math.max(safeStart, Math.min(e, snippet.length));
  if (safeEnd <= safeStart) {
    return <>{snippet}</>;
  }
  return (
    <>
      {snippet.slice(0, safeStart)}
      <mark className="rounded-[3px] bg-[#0B4D2E] px-0.5 not-italic text-white dark:bg-[#3DCF7A] dark:text-[#0C1210]">
        {snippet.slice(safeStart, safeEnd)}
      </mark>
      {snippet.slice(safeEnd)}
    </>
  );
}

/** Compact flip card for the Discover shelf — same front/back pattern as Word of the Day. */
export function RecentWordFlipCard({ item }: { item: ShelfWord }) {
  const [flipped, setFlipped] = useState(false);
  const phrase = (item.phrase || item.lyric?.snippet || '').trim();
  const title = (item.title || item.song?.title || '').trim();
  const artist = item.song?.artist?.trim() || '';
  const canFlip = Boolean(phrase || title);
  const spotifyHref =
    title || artist ? spotifyOpenUrlForSong(artist, title) : null;

  const toggle = () => {
    if (!canFlip) return;
    setFlipped((v) => !v);
  };

  return (
    <article className="group flex flex-col">
      <div className="daily-word-flip-scene shelf-word-flip-scene">
        <div
          className={`daily-word-flip-inner shelf-word-flip-inner ${flipped ? 'is-flipped' : ''}`}
          aria-live="polite"
        >
          {/* Front — vocabulary */}
          <button
            type="button"
            className="daily-word-flip-face daily-word-flip-front flex h-full w-full flex-col justify-between rounded-2xl border border-[#E4EBE6] bg-gradient-to-b from-[#E8F5EE] to-[#F7F8F6] p-4 text-left transition hover:border-[#0B4D2E]/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B4D2E] dark:border-[#2A3530] dark:from-[#0B4D2E]/30 dark:to-[#171E1B] dark:hover:border-[#3DCF7A]/50 dark:focus-visible:ring-[#3DCF7A]"
            onClick={toggle}
            aria-label={
              canFlip ? `Show lyric for ${item.word.text}` : item.word.text
            }
            disabled={!canFlip}
          >
            <div className="flex items-start justify-between gap-2">
              {item.word.part_of_speech ? (
                <span className="rounded-full border border-[#0B4D2E]/15 bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#0B4D2E] dark:border-[#3DCF7A]/25 dark:bg-[#0C1210]/40 dark:text-[#3DCF7A]">
                  {item.word.part_of_speech}
                </span>
              ) : (
                <span />
              )}
              {canFlip ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#7A8A80]">
                  <RotateCw className="h-2.5 w-2.5" aria-hidden />
                  Flip
                </span>
              ) : null}
            </div>

            <div className="min-w-0 space-y-1.5 py-2">
              <p className="font-display text-[1.65rem] leading-tight font-bold tracking-tight text-[#0B4D2E] break-words dark:text-[#3DCF7A]">
                {item.word.text}
              </p>
              {item.word.translation ? (
                <p className="text-sm font-medium text-[#5C6B62] dark:text-[#9AABA0]">
                  {item.word.translation}
                </p>
              ) : null}
              {item.word.pronunciation ? (
                <p className="font-serif text-xs italic text-[#7A8A80]">
                  {item.word.pronunciation}
                </p>
              ) : null}
            </div>

            {title ? (
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#7A8A80]">
                {title}
                {artist ? ` · ${artist}` : ''}
              </p>
            ) : (
              <span />
            )}
          </button>

          {/* Back — song title + lyric phrase (no links inside 3D face — hit-testing breaks) */}
          <div
            className="daily-word-flip-face daily-word-flip-back flex h-full w-full cursor-pointer flex-col rounded-2xl border border-[#E4EBE6] bg-white p-4 text-left shadow-sm dark:border-[#2A3530] dark:bg-[#171E1B]"
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Back to word"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#7A8A80]">
                <RotateCw className="h-2.5 w-2.5 shrink-0" aria-hidden />
                Flip back
              </span>
              {item.lyric?.timestamp ? (
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#9AABA0]">
                  {item.lyric.timestamp}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 space-y-3 overflow-hidden">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[#0B4D2E] dark:text-[#3DCF7A]">
                  <Music2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    In the song
                  </span>
                </div>
                {title ? (
                  <h3 className="line-clamp-2 text-base font-bold leading-snug text-[#0C1210] dark:text-[#F2F5F3]">
                    {title}
                  </h3>
                ) : null}
                {artist ? (
                  <p className="truncate text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                    {artist}
                  </p>
                ) : null}
              </div>

              {phrase ? (
                <blockquote className="border-l-2 border-[#0B4D2E]/30 pl-3 text-[13px] font-medium leading-relaxed text-[#0C1210] dark:border-[#3DCF7A]/40 dark:text-[#F2F5F3]">
                  <span className="line-clamp-4 italic">
                    &ldquo;
                    {highlightWord(
                      phrase,
                      item.lyric?.char_start,
                      item.lyric?.char_end
                    )}
                    &rdquo;
                  </span>
                </blockquote>
              ) : (
                <p className="text-xs text-[#5C6B62]">
                  Lyric line unavailable for this word.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Outside the 3D flip — same pattern as Word of the Day actions */}
      {spotifyHref ? (
        <a
          href={spotifyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#0B4D2E] bg-[#0B4D2E] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-[#093d25] dark:border-[#3DCF7A] dark:bg-[#3DCF7A] dark:text-[#0C1210] dark:hover:bg-[#2FB86A]"
        >
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          Open in Spotify
        </a>
      ) : null}
    </article>
  );
}
