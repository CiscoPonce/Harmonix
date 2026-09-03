'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Loader2, Search, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { DailyWordCard } from '@/components/DailyWordCard';
import { RecentWordFlipCard, type ShelfWord } from '@/components/RecentWordFlipCard';
import { ReviewCountBadge } from '@/components/ReviewCountBadge';
import { BadgeUnlockToast } from '@/components/BadgeUnlockToast';
import { apiFetch } from '@/lib/api';

type RecentWord = ShelfWord;

type ProgressStats = {
  streak_days: number;
  total_words: number;
  today_words: number;
  daily_goal: number;
  today_goal_met: boolean;
  badges_unlocked?: Array<{ id: string; name: string; icon?: string; category?: string }>;
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
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [unlockedBadge, setUnlockedBadge] = useState<{
    id: string;
    name: string;
    icon?: string;
    category?: string;
  } | null>(null);
  const [fromTrackRequest, setFromTrackRequest] = useState<{
    id: string;
    title?: string;
    artist?: string;
    nonce: number;
  } | null>(null);
  const [pickingTrackId, setPickingTrackId] = useState<number | null>(null);

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

  const refreshHomeData = useCallback(async (fromWord?: {
    word?: { text?: string; translation?: string | null; pronunciation?: string | null; part_of_speech?: string | null };
    lyric?: {
      snippet?: string;
      timestamp?: string;
      char_start?: number;
      char_end?: number;
    } | null;
    song?: { id?: string; title?: string; artist?: string } | null;
    date?: string;
  } | null) => {
    // Immediately keep WOTD lyric on the shelf (don't wait for /recent).
    if (fromWord?.word?.text && fromWord.song?.id) {
      const shelfItem: RecentWord = {
        word: {
          text: fromWord.word.text,
          translation: fromWord.word.translation ?? null,
          pronunciation: fromWord.word.pronunciation ?? null,
          part_of_speech: fromWord.word.part_of_speech ?? null,
        },
        title: fromWord.song.title ?? null,
        phrase: (fromWord.lyric?.snippet || '').trim() || null,
        lyric: fromWord.lyric?.snippet
          ? {
              snippet: fromWord.lyric.snippet,
              timestamp: fromWord.lyric.timestamp,
              char_start: fromWord.lyric.char_start,
              char_end: fromWord.lyric.char_end,
            }
          : null,
        song: {
          id: String(fromWord.song.id),
          title: fromWord.song.title || '',
          artist: fromWord.song.artist || '',
        },
      };
      setTrending((prev) => {
        const key = `${shelfItem.word.text}|${shelfItem.song?.id}`;
        const rest = prev.filter(
          (p) => `${p.word.text}|${p.song?.id}` !== key
        );
        return [shelfItem, ...rest].slice(0, 8);
      });
    }

    try {
      const [statsRes, recentRes] = await Promise.all([
        apiFetch('/progress/stats'),
        apiFetch('/daily-word/recent?days=14'),
      ]);
      if (statsRes.ok) {
        const statsData = (await statsRes.json()) as ProgressStats;
        setStats(statsData);
        if (statsData.badges_unlocked?.length) {
          const b = statsData.badges_unlocked[0];
          setUnlockedBadge({ id: b.id, name: b.name, icon: b.icon, category: b.category });
        }
      }
      if (recentRes.ok) {
        const data = await recentRes.json();
        const recent = (data.recent || []) as RecentWord[];
        // Prefer server rows, but never drop a richer local phrase if server omits it.
        setTrending((prev) => {
          const byKey = new Map<string, RecentWord>(
            prev.map((p) => [`${p.word.text}|${p.song?.id ?? ''}`, p])
          );
          return recent.map((row) => {
            const key = `${row.word.text}|${row.song?.id ?? ''}`;
            const local = byKey.get(key);
            const phrase = (
              row.phrase || row.lyric?.snippet || local?.phrase || local?.lyric?.snippet || ''
            ).trim();
            if (!phrase) return row;
            return {
              ...row,
              phrase,
              lyric: row.lyric?.snippet
                ? row.lyric
                : local?.lyric || {
                    snippet: phrase,
                    timestamp: row.lyric?.timestamp,
                    char_start: row.lyric?.char_start,
                    char_end: row.lyric?.char_end,
                  },
              title: row.title || row.song?.title || local?.title || null,
            };
          });
        });
      }
    } catch {
      /* keep current shelf / stats */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        setTrendingLoading(true);
        const [statsRes, recentRes] = await Promise.all([
          apiFetch('/progress/stats'),
          apiFetch('/daily-word/recent?days=14'),
        ]);
        if (!active) return;
        if (statsRes.ok) {
          const statsData = (await statsRes.json()) as ProgressStats;
          setStats(statsData);
          if (statsData.badges_unlocked?.length) {
            const b = statsData.badges_unlocked[0];
            setUnlockedBadge({ id: b.id, name: b.name, icon: b.icon, category: b.category });
          }
        }
        if (recentRes.ok) {
          const data = await recentRes.json();
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

  const goalPct =
    stats && stats.daily_goal > 0
      ? Math.min(100, (stats.today_words / stats.daily_goal) * 100)
      : 0;

  return (
    <AppShell
      userEmail={user.email}
      onLogout={logout}
      searchPlaceholder="Search a song for a word from its lyrics…"
      onSearchSubmit={(q) => {
        setQuery(q);
        document.getElementById('discover-song-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    >
      <BadgeUnlockToast badge={unlockedBadge} onDismiss={() => setUnlockedBadge(null)} />

      <section className="mx-auto w-full max-w-3xl" aria-label="Word of the Day">
        <DailyWordCard onWordChange={refreshHomeData} fromTrackRequest={fromTrackRequest} />
      </section>

      <section
        className="mx-auto mt-6 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3"
        aria-label="Practice"
      >
        {stats ? (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E4EBE6] bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#0C1210] dark:border-[#2A3530] dark:bg-[#171E1B] dark:text-[#F2F5F3]">
              <Flame className="h-3.5 w-3.5 text-[#0B4D2E] dark:text-[#3DCF7A]" aria-hidden />
              {stats.streak_days} day{stats.streak_days === 1 ? '' : 's'}
            </div>
            <div className="inline-flex min-w-[140px] flex-col gap-1 rounded-full border border-[#E4EBE6] bg-white px-3 py-1.5 dark:border-[#2A3530] dark:bg-[#171E1B]">
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-[#5C6B62] dark:text-[#9AABA0]">
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3 w-3" aria-hidden />
                  Today
                </span>
                <span>
                  {stats.today_words}
                  {stats.daily_goal ? `/${stats.daily_goal}` : ''}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#E4EBE6] dark:bg-[#2A3530]">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.today_goal_met ? 'bg-[#0B4D2E] dark:bg-[#3DCF7A]' : 'bg-[#7A8A80]'
                  }`}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
        <ReviewCountBadge />
      </section>

      <section
        id="discover-song-search"
        className="relative mt-10 overflow-hidden rounded-3xl bg-[#0B4D2E] px-6 py-8 text-white sm:px-10"
      >
        <p className="mb-3 text-sm font-medium text-white/80">
          Search a song, then tap it to learn a word from those lyrics.
        </p>
        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7A8A80]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a song for a word from its lyrics…"
            className="h-12 w-full rounded-full bg-white pl-12 pr-4 text-base text-[#0C1210] placeholder:text-[#9AABA0] focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Search a song for a Word of the Day"
          />
        </div>
        {(searching || query.trim()) && (
          <div className="relative mt-4 max-w-2xl" aria-label="Search results">
            {searching ? (
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching songs…
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-white/70">No songs found. Try the artist plus title.</p>
            ) : (
              <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white text-[#0C1210] shadow-lg">
                {results.slice(0, 8).map((track) => (
                  <li key={track.id}>
                    <button
                      type="button"
                      disabled={pickingTrackId === track.id}
                      onClick={() => {
                        setPickingTrackId(track.id);
                        setFromTrackRequest({
                          id: String(track.id),
                          title: track.title,
                          artist: track.artist?.name,
                          nonce: Date.now(),
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        window.setTimeout(() => setPickingTrackId(null), 800);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F8F6] disabled:opacity-60"
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
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#0B4D2E]">
                        {pickingTrackId === track.id ? 'Loading…' : 'Learn a word'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-12" aria-label="Recent words">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0C1210] dark:text-[#F2F5F3]">
              Your shelf
            </h2>
            <p className="mt-1 text-xs text-[#5C6B62] dark:text-[#9AABA0]">
              Tap a card to flip — song title and lyric phrase on the back.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {trendingLoading ? (
            <div className="col-span-full flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#0B4D2E] dark:text-[#3DCF7A]" />
            </div>
          ) : trending.length === 0 ? (
            <p className="col-span-full text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Flip today&apos;s word above — your shelf fills as you discover more.
            </p>
          ) : (
            trending.slice(0, 8).map((item, i) => (
              <RecentWordFlipCard
                key={`${item.id ?? item.word.text}-${item.song?.id || i}`}
                item={item}
              />
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
