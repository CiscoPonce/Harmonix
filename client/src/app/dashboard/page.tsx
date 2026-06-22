'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SongSearch } from '@/components/SongSearch';
import { DailyWordCard } from '@/components/DailyWordCard';
import { Sparkles, Trophy, BookOpen, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<{
    streak_days: number;
    total_xp: number;
    today_answers: number;
    daily_goal: number;
    today_goal_met: boolean;
  } | null>(null);

  const [recentSessions, setRecentSessions] = useState<Array<{
    session_id: string;
    song_id: string;
    completed_at: string;
    score: number;
    total_questions: number;
    song_title: string | null;
    song_artist: string | null;
  }>>([]);

  const [loadingData, setLoadingData] = useState(true);
  const dailyWordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    
    let active = true;
    async function fetchData() {
      try {
        const [statsRes, recentRes] = await Promise.all([
          apiFetch('/progress/stats'),
          apiFetch('/study/recent')
        ]);
        
        if (!active) return;

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          setRecentSessions(recentData.recent || []);
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

  const scrollToDailyWord = () => {
    dailyWordRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Harmonix" width={64} height={64} className="animate-pulse" />
          <p className="text-xl font-medium animate-pulse uppercase tracking-widest italic font-black">Harmonix</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Navigation */}
      <nav className="p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Harmonix" width={48} height={48} />
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">Harmonix</h1>
        </Link>
        <div className="flex items-center gap-6">
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
          <DailyWordCard />
        </div>

        <section className="w-full mt-16 space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600">Or explore</h3>
            <p className="text-zinc-500 text-sm">Search any song to extract more vocabulary.</p>
          </div>
          <SongSearch />
        </section>

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-3 w-full mt-24">
          {/* Recent sessions card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Recent</h3>
            {loadingData ? (
              <div className="space-y-3 animate-pulse flex-1">
                <div className="h-10 bg-zinc-900 rounded w-full"></div>
                <div className="h-10 bg-zinc-900 rounded w-full"></div>
              </div>
            ) : recentSessions.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {recentSessions.map((session) => (
                  <Link 
                    key={session.session_id} 
                    href={`/player/${session.song_id}`}
                    className="block p-3 rounded-lg border border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-black/40 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/20 transition-all group/item"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate uppercase tracking-wider">
                          {session.song_title || 'Unknown Song'}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
                          {session.song_artist || 'Unknown Artist'}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className="text-xs font-black text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800">
                          {session.score}/{session.total_questions}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed flex-1">Your last learning sessions will appear here.</p>
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
                    <span className="text-zinc-500">Total XP</span>
                    <span className="text-zinc-900 dark:text-white">{stats.total_xp} XP</span>
                  </div>
                </div>
                <div className="space-y-1 mt-auto">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Daily Goal</span>
                    <span>{stats.today_answers}/{stats.daily_goal} answers</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${stats.today_goal_met ? 'bg-green-500' : 'bg-zinc-500'}`}
                      style={{ width: `${Math.min(100, (stats.today_answers / stats.daily_goal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed flex-1">Track your streak and vocabulary progress.</p>
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
        </div>
      </main>

      {/* Footer */}
      <footer className="p-12 text-center border-t border-zinc-200 dark:border-zinc-900">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-800 uppercase tracking-[0.3em]">Harmonix &copy; 2026</p>
      </footer>
    </div>
  );
}
