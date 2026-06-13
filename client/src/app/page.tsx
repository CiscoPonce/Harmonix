'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SongSearch } from '@/components/SongSearch';
import { DailyWordCard } from '@/components/DailyWordCard';
import { Sparkles, Trophy, BookOpen, Clock } from 'lucide-react';

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-xl font-medium animate-pulse uppercase tracking-widest italic font-black">LyricWord</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* Navigation */}
      <nav className="p-6 flex items-center justify-between border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <h1 className="text-2xl font-black tracking-tighter uppercase italic">LyricWord</h1>
        <div className="flex items-center gap-6">
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
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

        <DailyWordCard />

        <section className="w-full mt-16 space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600">Or explore</h3>
            <p className="text-zinc-500 text-sm">Search any song to extract more vocabulary.</p>
          </div>
          <SongSearch />
        </section>

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-3 w-full mt-24">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-8 transition-all hover:border-zinc-700 group">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-black transition-colors">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2">Recent</h3>
            <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">Your last learning sessions will appear here.</p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-8 transition-all hover:border-zinc-700 group">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-black transition-colors">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2">Stats</h3>
            <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">Track your streak and vocabulary progress.</p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-8 transition-all hover:border-zinc-700 group">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-black transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2">Daily</h3>
            <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">One word, one song, one lyric moment — every day.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-12 text-center border-t border-zinc-900">
        <p className="text-[10px] font-bold text-zinc-800 uppercase tracking-[0.3em]">LyricWord &copy; 2026</p>
      </footer>
    </div>
  );
}
