'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Plus, Search, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { apiFetch } from '@/lib/api';

const TAGS = ['#FRENCH_POP', '#JAZZ_LATINO', '#OPERA_REMIX'] as const;

export default function DiscoverPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ id: number; title: string; artist: { name: string }; album?: { cover_medium?: string } }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<
    Array<{
      word: { text: string; translation: string | null };
      song: { id: string; title: string; artist: string } | null;
    }>
  >([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!user.native_language) {
      const key = 'onboarding_redirected';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, 'true');
        router.push('/onboarding');
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch('/daily-word/recent?days=7');
        if (!active || !res.ok) return;
        const data = await res.json();
        setRecent(data.recent || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.data || data.results || []);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [query]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8F6] dark:bg-[#0C1210]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0B4D2E] dark:text-[#3DCF7A]" aria-label="Loading" />
      </div>
    );
  }

  return (
    <AppShell userEmail={user.email} onLogout={logout} searchPlaceholder="Search lyrics, artists, or languages...">
      {/* Hero search */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0B4D2E] px-6 py-12 text-white sm:px-10 sm:py-16">
        <h1 className="font-display text-4xl font-bold italic tracking-tight sm:text-5xl">
          Find your resonance.
        </h1>
        <div className="relative mt-8 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7A8A80]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lyrics, artists, or languages..."
            className="h-14 w-full rounded-full bg-white pl-12 pr-20 text-base text-[#0C1210] placeholder:text-[#9AABA0] focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Discover search"
          />
          <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-[#EEF2EF] px-2 py-1 text-[10px] font-bold text-[#5C6B62] sm:inline">
            CTRL K
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setQuery(tag.replace('#', '').replace('_', ' '))}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-[#D7EDE0] ring-1 ring-white/20 hover:bg-white/20"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Search results */}
      {(searching || results.length > 0) && (
        <section className="mt-8 space-y-3" aria-label="Search results">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
            Results
          </h2>
          {searching ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#0B4D2E] dark:text-[#3DCF7A]" />
          ) : (
            <ul className="divide-y divide-[#E4EBE6] overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white dark:divide-[#2A3530] dark:border-[#2A3530] dark:bg-[#171E1B]">
              {results.slice(0, 8).map((track) => (
                <li key={track.id}>
                  <Link
                    href={`/player/${track.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F8F6] dark:hover:bg-[#1A2420]"
                  >
                    {track.album?.cover_medium ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.album.cover_medium}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-[#E8F5EE]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{track.title}</p>
                      <p className="truncate text-sm text-[#5C6B62]">{track.artist?.name}</p>
                    </div>
                    <Play className="h-4 w-4 text-[#0B4D2E]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Global Echo */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
              Global echo
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0C1210] dark:text-[#F2F5F3]">
              Trending Top 5
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-widest text-[#0B4D2E] hover:underline dark:text-[#3DCF7A]"
          >
            View charts →
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Link
            href="/dashboard"
            className="relative col-span-1 flex min-h-[280px] flex-col justify-end overflow-hidden rounded-3xl bg-[#0B4D2E] p-6 text-white lg:row-span-2"
          >
            <span className="absolute left-4 top-4 rounded-full bg-[#3DCF7A] px-3 py-1 text-[10px] font-bold text-[#0B4D2E]">
              #1 WORLDWIDE
            </span>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(61,207,122,0.35),transparent_55%)]" />
            <div className="relative">
              <h3 className="font-display text-3xl font-bold italic">Word of the Day</h3>
              <p className="mt-1 text-sm text-[#D7EDE0]">Continue your linguistic resonance practice</p>
            </div>
          </Link>

          <div className="rounded-2xl border border-[#E4EBE6] bg-[#F0F3F1] p-5 dark:border-[#2A3530] dark:bg-[#171E1B]">
            <div className="flex items-start justify-between">
              <span className="font-display text-4xl font-bold text-[#C5D0C9] dark:text-[#2A3530]">
                02
              </span>
              <TrendingUp className="h-4 w-4 text-[#0B4D2E] dark:text-[#3DCF7A]" />
            </div>
            <h3 className="mt-6 text-lg font-bold">Library playlists</h3>
            <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Harmonix + Spotify collections
            </p>
            <Link
              href="/playlists"
              className="mt-4 inline-block text-sm font-bold text-[#0B4D2E] dark:text-[#3DCF7A]"
            >
              Open Library →
            </Link>
          </div>

          <div className="rounded-2xl border border-[#E4EBE6] bg-[#F0F3F1] p-5 dark:border-[#2A3530] dark:bg-[#171E1B]">
            <div className="flex items-start justify-between">
              <span className="font-display text-4xl font-bold text-[#C5D0C9] dark:text-[#2A3530]">
                03
              </span>
              <TrendingUp className="h-4 w-4 text-[#0B4D2E] dark:text-[#3DCF7A]" />
            </div>
            <h3 className="mt-6 text-lg font-bold">SRS Review</h3>
            <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Spaced repetition for lasting vocab
            </p>
            <Link
              href="/review"
              className="mt-4 inline-block text-sm font-bold text-[#0B4D2E] dark:text-[#3DCF7A]"
            >
              Start review →
            </Link>
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-4 rounded-2xl border border-[#E4EBE6] bg-white p-4 dark:border-[#2A3530] dark:bg-[#171E1B] lg:col-span-2"
          >
            <span className="font-display text-2xl font-bold text-[#C5D0C9]">04</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Connect Spotify</p>
              <p className="text-sm text-[#5C6B62]">Link playlists from Settings</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B4D2E] text-white">
              <Play className="h-4 w-4" />
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="fixed bottom-24 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B4D2E] text-white shadow-lg hover:bg-[#093F25] lg:bottom-8"
          aria-label="Quick add"
          onClick={() => router.push('/playlists')}
        >
          <Plus className="h-6 w-6" />
        </button>
      </section>

      {/* Personal Resonance */}
      <section className="mt-12">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
          Personal resonance
        </p>
        <h2 className="font-display text-xl font-bold">Songs similar to your recent words</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {recent.length === 0 ? (
            <p className="col-span-full text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Discover a Word of the Day to seed your resonance shelf.
            </p>
          ) : (
            recent.slice(0, 5).map((item, i) => (
              <Link
                key={`${item.word.text}-${i}`}
                href={item.song?.id ? `/player/${item.song.id}` : '/dashboard'}
                className="group"
              >
                <div className="aspect-square overflow-hidden rounded-2xl bg-[#E8F5EE] transition group-hover:ring-2 group-hover:ring-[#0B4D2E] dark:bg-[#0B4D2E]/35 dark:group-hover:ring-[#3DCF7A]">
                  <div className="flex h-full items-center justify-center p-4 text-center">
                    <span className="font-display text-2xl font-bold text-[#0B4D2E] dark:text-[#3DCF7A]">
                      {item.word.text}
                    </span>
                  </div>
                </div>
                <p className="mt-2 truncate text-sm font-bold">
                  {item.song?.title || item.word.translation || item.word.text}
                </p>
                <p className="truncate text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                  {item.song?.artist || 'Daily Word'}
                </p>
                <span className="mt-1 inline-block rounded-full bg-[#E8F5EE] px-2 py-0.5 text-[10px] font-bold text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                  {90 - i * 3}% MATCH
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
