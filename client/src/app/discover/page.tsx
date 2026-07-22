'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { DailyWordCard } from '@/components/DailyWordCard';
import { apiFetch } from '@/lib/api';

type RecentWord = {
  word: { text: string; translation: string | null };
  song: { id: string; title: string; artist: string } | null;
};

export default function DiscoverPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ id: number; title: string; artist: { name: string }; album?: { cover_medium?: string } }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [trending, setTrending] = useState<RecentWord[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) setQuery(q);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        setTrendingLoading(true);
        const res = await apiFetch('/daily-word/recent?days=14');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setTrending(data.recent || []);
        }
      } catch {
        if (active) setTrending([]);
      } finally {
        if (active) setTrendingLoading(false);
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
      <section className="mx-auto w-full max-w-3xl" aria-label="Word of the Day">
        <DailyWordCard
          onWordChange={() => {
            void (async () => {
              try {
                const res = await apiFetch('/daily-word/recent?days=14');
                if (res.ok) {
                  const data = await res.json();
                  setTrending(data.recent || []);
                }
              } catch {
                /* keep current shelf */
              }
            })();
          }}
        />
      </section>

      <section className="relative mt-10 overflow-hidden rounded-3xl bg-[#0B4D2E] px-6 py-8 text-white sm:px-10">
        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7A8A80]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lyrics, artists, or languages..."
            className="h-12 w-full rounded-full bg-white pl-12 pr-4 text-base text-[#0C1210] placeholder:text-[#9AABA0] focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Discover search"
          />
        </div>
      </section>

      {(searching || results.length > 0) && (
        <section className="mt-8 space-y-3" aria-label="Search results">
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

      <section className="mt-12" aria-label="Trending in other words">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {trendingLoading ? (
            <div className="col-span-full flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#0B4D2E] dark:text-[#3DCF7A]" />
            </div>
          ) : trending.length === 0 ? (
            <p className="col-span-full text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Flip today&apos;s word above — your trending shelf fills as you discover more.
            </p>
          ) : (
            trending.slice(0, 8).map((item, i) => (
              <Link
                key={`${item.word.text}-${item.song?.id || i}`}
                href={item.song?.id ? `/player/${item.song.id}` : '/discover'}
                className="group"
              >
                <div className="aspect-square overflow-hidden rounded-2xl border border-[#E4EBE6] bg-[#E8F5EE] transition group-hover:ring-2 group-hover:ring-[#0B4D2E] dark:border-[#2A3530] dark:bg-[#0B4D2E]/25 dark:group-hover:ring-[#3DCF7A]">
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    <span className="font-display text-2xl font-bold text-[#0B4D2E] dark:text-[#3DCF7A]">
                      {item.word.text}
                    </span>
                    {item.word.translation ? (
                      <span className="line-clamp-2 text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                        {item.word.translation}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 truncate text-sm font-bold">
                  {item.song?.title || item.word.text}
                </p>
                <p className="truncate text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                  {item.song?.artist || 'Daily Word'}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
