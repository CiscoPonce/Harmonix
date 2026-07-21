'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SongSearch } from '@/components/SongSearch';
import { DailyWordCard } from '@/components/DailyWordCard';
import { ReviewCountBadge } from '@/components/ReviewCountBadge';
import { BadgeUnlockToast } from '@/components/BadgeUnlockToast';
import { DashboardMatureCards } from '@/components/DashboardMatureCards';
import { Trophy, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';

/** Daily promo, Achievements, and Playlists cards — enable when ready for launch. */
const SHOW_MATURE_DASHBOARD_CARDS = false;

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<{
    streak_days: number;
    total_words: number;
    today_words: number;
    daily_goal: number;
    today_goal_met: boolean;
  } | null>(null);

  const [recentDailyWords, setRecentDailyWords] = useState<Array<{
    id: number | null;
    date: string;
    discovered_at: string | null;
    word: { text: string; translation: string | null };
    song: { id: string; title: string; artist: string } | null;
  }>>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [unlockedBadge, setUnlockedBadge] = useState<{ id: string; name: string; icon?: string; category?: string } | null>(null);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; song_count: number }>>([]);
  const dailyWordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (!user.native_language) {
        const key = 'onboarding_redirected';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'true');
          router.push('/onboarding');
        }
      }
    }
  }, [user, isLoading, router]);

  const refreshDashboardData = useCallback(async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        apiFetch('/progress/stats'),
        apiFetch('/daily-word/recent?days=7'),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setRecentDailyWords(recentData.recent || []);
      }
    } catch (err) {
      console.error('Error refreshing dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    
    let active = true;
    async function fetchData() {
      try {
        const requests = [
          apiFetch('/progress/stats'),
          apiFetch('/daily-word/recent?days=7'),
        ] as const;
        const fetches = SHOW_MATURE_DASHBOARD_CARDS
          ? [...requests, apiFetch('/playlists?limit=3')]
          : [...requests];
        const results = await Promise.all(fetches);
        const statsRes = results[0];
        const recentRes = results[1];
        const playlistsRes = SHOW_MATURE_DASHBOARD_CARDS ? results[2] : null;
        
        if (!active) return;

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
          if (statsData.badges_unlocked?.length > 0) {
            const b = statsData.badges_unlocked[0];
            setUnlockedBadge({ id: b.id, name: b.name, icon: b.icon, category: b.category });
          }
        }
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          setRecentDailyWords(recentData.recent || []);
        }
        if (playlistsRes?.ok) {
          const playlistsData = await playlistsRes.json();
          setPlaylists(playlistsData.playlists || []);
          if (playlistsData.badges_unlocked?.length > 0) {
            const b = playlistsData.badges_unlocked[0];
            setUnlockedBadge({ id: b.id, name: b.name, icon: b.icon, category: b.category });
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    }
    
    fetchData();
    return () => { active = false; };
  }, [user]);

  const formatDailyWordDate = (dateStr: string) => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    if (dateStr === todayKey) return 'Today';
    if (dateStr === yesterdayKey) return 'Yesterday';
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDiscoveredTime = (discoveredAt: string | null) => {
    if (!discoveredAt) return null;
    const when = new Date(`${discoveredAt.replace(' ', 'T')}Z`);
    if (Number.isNaN(when.getTime())) return null;
    return when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const scrollToDailyWord = () => {
    dailyWordRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8F6] text-[#0C1210] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
        <div className="flex flex-col items-center gap-3">
          <HarmonixWordmark href={null} showTagline />
          <p className="animate-pulse text-sm font-medium uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
            Loading
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppShell
      userEmail={user.email}
      onLogout={logout}
      searchPlaceholder="Search for tracks, lyrics, or definitions..."
    >
      <BadgeUnlockToast badge={unlockedBadge} onDismiss={() => setUnlockedBadge(null)} />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
        <p className="mb-2 self-start text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A8A80] dark:text-[#9AABA0]">
          Word of the day
        </p>
        <div ref={dailyWordRef} className="flex w-full max-w-3xl justify-center">
          <DailyWordCard onWordChange={refreshDashboardData} />
        </div>

        <section className="mt-12 w-full space-y-4">
          <div className="space-y-2 text-center">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#5C6B62] dark:text-[#9AABA0]">
              Or explore
            </h3>
            <p className="text-sm text-[#7A8A80] dark:text-[#9AABA0]">
              Search any song to extract more vocabulary.
            </p>
          </div>
          <SongSearch />
        </section>

        <ReviewCountBadge />

        <div className="mt-16 grid w-full min-w-0 gap-4 sm:mt-20 sm:grid-cols-2 sm:gap-6">
          <div className="group flex min-h-[250px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B] sm:p-8">
            <div className="mb-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F5EE] text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="mb-1 shrink-0 font-display text-xl font-bold italic tracking-tight">Recent</h3>
            <p className="mb-3 shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
              Words you discovered · last 7 days
            </p>
            {loadingData ? (
              <div className="flex-1 animate-pulse space-y-3">
                <div className="h-10 w-full rounded bg-zinc-200 dark:bg-zinc-800"></div>
                <div className="h-10 w-full rounded bg-zinc-200 dark:bg-zinc-800"></div>
              </div>
            ) : recentDailyWords.length > 0 ? (
              <div className="max-h-[220px] flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {recentDailyWords.map((entry) => {
                  const timeLabel = formatDiscoveredTime(entry.discovered_at);
                  return (
                  <Link
                    key={entry.id ?? `${entry.date}-${entry.word.text}`}
                    href={entry.song?.id ? `/player/${entry.song.id}` : '#'}
                    className="group/item block rounded-lg border border-[#E4EBE6] bg-[#F7F8F6] p-3 transition-all hover:border-[#0B4D2E]/30 hover:bg-[#E8F5EE] dark:border-[#2A3530] dark:bg-[#121A17] dark:hover:border-[#3DCF7A]/40 dark:hover:bg-[#0B4D2E]/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold uppercase tracking-wide text-[#0C1210] dark:text-[#F2F5F3]">
                          {entry.word.text}
                        </p>
                        <p className="line-clamp-2 text-[11px] leading-snug text-[#5C6B62] dark:text-[#9AABA0]">
                          {entry.word.translation || entry.song?.title || 'Discovered word'}
                        </p>
                        {entry.song && (
                          <p className="mt-0.5 truncate text-[10px] text-[#7A8A80] dark:text-[#9AABA0]">
                            {entry.song.title} · {entry.song.artist}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
                          {formatDailyWordDate(entry.date)}
                        </span>
                        {timeLabel && (
                          <span className="mt-0.5 block text-[10px] text-[#9AABA0]">{timeLabel}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            ) : (
              <p className="flex-1 text-sm font-medium normal-case leading-relaxed tracking-normal text-zinc-500 dark:text-zinc-400 sm:uppercase sm:tracking-widest">
                Every word you discover will show up here — daily words and refreshes included.
              </p>
            )}
          </div>

          <div className="group flex min-h-[250px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B] sm:p-8">
            <div className="mb-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F5EE] text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
              <Trophy className="h-6 w-6" />
            </div>
            <h3 className="mb-2 shrink-0 font-display text-xl font-bold italic tracking-tight">Stats</h3>
            {loadingData ? (
              <div className="flex-1 animate-pulse space-y-4">
                <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800"></div>
                <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800"></div>
                <div className="h-6 w-full rounded bg-zinc-200 dark:bg-zinc-800"></div>
              </div>
            ) : stats ? (
              <div className="flex flex-1 flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-[#7A8A80] dark:text-[#9AABA0]">Streak</span>
                    <span className="flex items-center gap-1 text-[#0C1210] dark:text-[#F2F5F3]">
                      {stats.streak_days} {stats.streak_days > 0 ? '🔥' : '❄️'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-[#7A8A80] dark:text-[#9AABA0]">Words learned</span>
                    <span className="text-[#0C1210] dark:text-[#F2F5F3]">{stats.total_words}</span>
                  </div>
                </div>
                <div className="mt-auto space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
                    <span>Words today</span>
                    <span>
                      {stats.today_words}
                      {stats.daily_goal ? ` (goal ${stats.daily_goal})` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E4EBE6] dark:bg-[#2A3530]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${stats.today_goal_met ? 'bg-[#0B4D2E] dark:bg-[#3DCF7A]' : 'bg-[#7A8A80]'}`}
                      style={{
                        width: `${Math.min(100, (stats.today_words / stats.daily_goal) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium normal-case sm:uppercase tracking-normal sm:tracking-widest leading-relaxed flex-1">Track your daily word streak and progress.</p>
            )}
          </div>

          {SHOW_MATURE_DASHBOARD_CARDS && (
            <DashboardMatureCards
              loadingData={loadingData}
              playlists={playlists}
              onScrollToDailyWord={scrollToDailyWord}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
