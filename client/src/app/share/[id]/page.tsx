'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, Loader2, Music2 } from 'lucide-react';

type Postcard = {
  id: string;
  word: {
    text: string;
    translation?: string | null;
    pronunciation?: string | null;
    part_of_speech?: string | null;
  };
  lyric: {
    snippet: string;
    char_start: number;
    char_end: number;
  } | null;
  song: {
    id?: string | null;
    title: string;
    artist: string;
  };
  spotify_url: string | null;
};

function highlightSnippet(snippet: string, start: number, end: number) {
  const safeStart = Math.max(0, Math.min(start, snippet.length));
  const safeEnd = Math.max(safeStart, Math.min(end, snippet.length));
  return (
    <>
      {snippet.slice(0, safeStart)}
      <mark className="rounded-sm bg-white px-1 text-black not-italic">
        {snippet.slice(safeStart, safeEnd)}
      </mark>
      {snippet.slice(safeEnd)}
    </>
  );
}

export default function SharePostcardPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [card, setCard] = useState<Postcard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Missing postcard id.');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const headers: HeadersInit = {};
        if (typeof window !== 'undefined') {
          const host = window.location.hostname;
          if (host.includes('ngrok-free.app') || host.includes('ngrok-free.dev')) {
            headers['ngrok-skip-browser-warning'] = 'true';
          }
        }
        const res = await fetch(`/api/share/postcards/${encodeURIComponent(id)}`, {
          headers,
          credentials: 'omit',
        });
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? 'This postcard was not found.' : 'Could not load postcard.'
          );
        }
        const data = (await res.json()) as Postcard;
        if (!cancelled) setCard(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load postcard.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06140e] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#06140e] px-6 text-center text-white">
        <p className="text-sm text-zinc-400">{error || 'Postcard unavailable.'}</p>
        <Link
          href="/register"
          className="text-sm font-bold uppercase tracking-widest text-emerald-400 underline"
        >
          Try Harmonix
        </Link>
      </div>
    );
  }

  const meaning = card.word.translation?.trim();
  const spotifyHref = card.spotify_url || null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06140e] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(61,207,122,0.28), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(11,77,46,0.55), transparent 50%), linear-gradient(180deg, #0a1f16 0%, #06140e 45%, #030a07 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/90">
          Harmonix · Word postcard
        </p>

        <article className="mt-8 flex flex-1 flex-col justify-center">
          <div className="rounded-3xl border border-white/10 bg-black/35 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Today&apos;s word
            </p>
            <h1 className="font-display mt-3 text-5xl font-semibold leading-none tracking-tight text-white sm:text-6xl">
              {card.word.text}
            </h1>

            {meaning && (
              <p className="mt-4 text-lg text-emerald-200/90 sm:text-xl">{meaning}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {card.word.pronunciation && <span>{card.word.pronunciation}</span>}
              {card.word.part_of_speech && <span>· {card.word.part_of_speech}</span>}
            </div>

            {card.lyric?.snippet && (
              <blockquote className="mt-8 border-l-2 border-emerald-500/50 pl-4 text-base italic leading-relaxed text-zinc-200 sm:text-lg">
                &ldquo;
                {highlightSnippet(
                  card.lyric.snippet,
                  card.lyric.char_start,
                  card.lyric.char_end
                )}
                &rdquo;
              </blockquote>
            )}

            <div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-6">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <Music2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{card.song.title}</p>
                <p className="truncate text-xs uppercase tracking-widest text-zinc-500">
                  {card.song.artist}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {spotifyHref ? (
              <a
                href={spotifyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1DB954] px-5 text-sm font-bold text-black transition hover:brightness-110"
              >
                <Image
                  src="/spotify-logo.svg"
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px]"
                  unoptimized
                />
                Open in Spotify
                <ExternalLink className="h-4 w-4 opacity-70" />
              </a>
            ) : (
              <p className="text-center text-xs text-zinc-500">
                Spotify link unavailable for this song.
              </p>
            )}

            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 text-sm font-bold uppercase tracking-widest text-white transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
            >
              Learn this word on Harmonix
            </Link>
          </div>
        </article>

        <p className="mt-10 text-center text-[10px] uppercase tracking-[0.25em] text-zinc-600">
          Language through real lyrics
        </p>
      </main>
    </div>
  );
}
