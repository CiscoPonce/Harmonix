'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SongSearch } from '@/components/SongSearch';
import { DailyWordCard } from '@/components/DailyWordCard';
import { BadgeGrid } from '@/components/BadgeGrid';
import { LanguageBadge } from '@/components/LanguageBadge';
import { ReviewCountBadge } from '@/components/ReviewCountBadge';
import { BadgeUnlockToast } from '@/components/BadgeUnlockToast';
import { Sparkles, Trophy, BookOpen, Clock, Award, ListMusic } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';

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
    date: string;
    word: { text: string; translation: string | null };
    song: { id: string; title: string; artist: string } | null;
  }>>([]);

  const [playlists, setPlaylists] = useState<Array<{
    id: string;
    name: string;
    song_count: number;
  }>>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [unlockedBadge, setUnlockedBadge] = useState<{ id: string; name: string; icon?: string; category?: string } | null>(null);
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
        const [statsRes, recentRes, playlistsRes] = await Promise.all([
          apiFetch('/progress/stats'),
          apiFetch('/daily-word/recent?days=7'),
          apiFetch('/playlists?limit=3')
        ]);
        
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
        if (playlistsRes.ok) {
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
    const date = new Date(`${dateStr}T12:00:00`);
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    if (dateStr === todayKey) return 'Today';
    if (dateStr === yesterdayKey) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const scrollToDailyWord = () => {
    dailyWordRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Harmonix" width={2816} height={1536} className="h-16 w-auto animate-pulse" />
          <p className="text-xl font-medium animate-pulse uppercase tracking-widest italic font-black">Harmonix</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      <BadgeUnlockToast badge={unlockedBadge} onDismiss={() => setUnlockedBadge(null)} />

      {/* Navigation */}
      <nav className="p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Harmonix" width={2816} height={1536} className="h-12 w-auto" />
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">Harmonix</h1>
        </Link>
        <div className="flex items-center gap-4">
          <LanguageBadge />
          <ThemeToggle />
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Logged in as</span>
            <span className="text-xs font-bold">{user.email}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={logout} className="text-[10px] font-bold uppercase tracking-widest h-8">
            Logout
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-6 py-12 md:py-24 max-w-5xl mx-auto w-full">
        {/* Hero Section */}
        <section className="w-full text-center space-y-6 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            Learn through the music you love
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-tight">
            Today&apos;s <span className="text-zinc-600">word</span>
          </h2>
          <p className="max-w-xl mx-auto text-zinc-500 font-medium md:text-lg">
            Get one personalized word, hear it in a real song lyric, then dive deeper when you are ready.
          </p>
        </section>

        <div ref={dailyWordRef} className="w-full max-w-3xl flex justify-center">
          <DailyWordCard onWordChange={refreshDashboardData} />
        </div>

        <section className="w-full mt-16 space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600">Or explore</h3>
            <p className="text-zinc-500 text-sm">Search any song to extract more vocabulary.</p>
          </div>
          <SongSearch />
        </section>

        <ReviewCountBadge />

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-2 w-full mt-24">
          {/* Recent daily words card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-1 shrink-0">Recent</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 shrink-0">Last 7 days</p>
            {loadingData ? (
              <div className="space-y-3 animate-pulse flex-1">
                <div className="h-10 bg-zinc-900 rounded w-full"></div>
                <div className="h-10 bg-zinc-900 rounded w-full"></div>
              </div>
            ) : recentDailyWords.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {recentDailyWords.map((entry) => (
                  <Link
                    key={entry.date}
                    href={entry.song?.id ? `/player/${entry.song.id}` : '#'}
                    className="block p-3 rounded-lg border border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-black/40 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/20 transition-all group/item"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-zinc-900 dark:text-white truncate uppercase tracking-wider">
                          {entry.word.text}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
                          {entry.word.translation || entry.song?.title || 'Daily word'}
                        </p>
                        {entry.song && (
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {entry.song.title} · {entry.song.artist}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {formatDailyWordDate(entry.date)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed flex-1">
                Your daily words from the past 7 days will appear here.
              </p>
            )}
          </div>

          {/* Stats card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Stats</h3>
            {loadingData ? (
              <div className="space-y-4 animate-pulse flex-1">
                <div className="h-4 bg-zinc-900 rounded w-2/3"></div>
                <div className="h-4 bg-zinc-900 rounded w-1/2"></div>
                <div className="h-6 bg-zinc-900 rounded w-full"></div>
              </div>
            ) : stats ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">Streak</span>
                    <span className="text-zinc-900 dark:text-white flex items-center gap-1">
                      {stats.streak_days} {stats.streak_days > 0 ? '🔥' : '❄️'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">Words learned</span>
                    <span className="text-zinc-900 dark:text-white">{stats.total_words}</span>
                  </div>
                </div>
                <div className="space-y-1 mt-auto">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Today&apos;s word</span>
                    <span>{stats.today_words}/{stats.daily_goal}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${stats.today_goal_met ? 'bg-green-500' : 'bg-zinc-500'}`}
                      style={{ width: `${Math.min(100, (stats.today_words / stats.daily_goal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed flex-1">Track your daily word streak and progress.</p>
            )}
          </div>

          {/* Daily word scroll card */}
          <div 
            onClick={scrollToDailyWord}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group cursor-pointer flex flex-col min-h-[250px]"
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Daily</h3>
            <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed flex-1">One word, one song, one lyric moment — every day.</p>
          </div>

          {/* Achievements card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Achievements</h3>
            <div className="flex-1">
              <BadgeGrid />
            </div>
          </div>

          {/* Playlists card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
              <ListMusic className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Playlists</h3>
            {loadingData ? (
              <div className="space-y-3 animate-pulse flex-1">
                <div className="h-8 bg-zinc-900 rounded w-full"></div>
                <div className="h-8 bg-zinc-900 rounded w-full"></div>
                <div className="h-8 bg-zinc-900 rounded w-3/4"></div>
              </div>
            ) : playlists.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {playlists.map((pl) => (
                  <Link
                    key={pl.id}
                    href={`/playlists/${pl.id}`}
                    className="flex justify-between items-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-black/40 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/20 transition-all group/item"
                  >
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate uppercase tracking-wider">{pl.name}</span>
                    <span className="text-[10px] text-zinc-500 font-bold shrink-0 ml-2">{pl.song_count} {pl.song_count === 1 ? 'song' : 'songs'}</span>
                  </Link>
                ))}
                <Link
                  href="/playlists"
                  className="block text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white py-2 mt-1 border-t border-zinc-800/50"
                >
                  View all →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed flex-1">
                Your collection is empty.{' '}
                <Link href="/" className="underline underline-offset-4 hover:text-white">Explore songs</Link>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-12 text-center border-t border-zinc-200 dark:border-zinc-900">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-800 uppercase tracking-[0.3em]">Harmonix &copy; 2026</p>
      </footer>
    </div>
  );
}
