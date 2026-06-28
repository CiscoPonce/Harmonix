'use client';

import { useState, useEffect } from 'react';
import { Flame, BookOpen, Award, ListMusic, CalendarDays, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame, BookOpen, Award, ListMusic, CalendarDays,
};

const BADGE_COLORS: Record<string, string> = {
  streak: 'text-purple-500',
  vocabulary: 'text-pink-500',
  quiz: 'text-blue-500',
  playlist: 'text-orange-500',
  daily_word: 'text-teal-500',
};

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: number;
}

export function BadgeGrid() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchBadges() {
      try {
        const res = await apiFetch('/badges');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setBadges(data.badges || []);
        } else {
          setError('Could not load achievements. Try again.');
        }
      } catch {
        if (active) setError('Could not load achievements. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchBadges();
    return () => { active = false; };
  }, []);

  const sortedBadges = [...badges].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return b.unlocked - a.unlocked;
    return a.id.localeCompare(b.id);
  });

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-zinc-900"></div>
            <div className="h-3 w-16 bg-zinc-900 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500 font-bold uppercase tracking-widest">{error}</p>;
  }

  if (badges.length === 0) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm font-black uppercase tracking-widest">No achievements yet</p>
        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">
          Complete lessons, build streaks, and explore songs to unlock badges.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white underline underline-offset-4"
        >
          Start learning
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {sortedBadges.map((badge) => {
        const IconComp = BADGE_ICONS[badge.icon] || Award;
        const colorClass = BADGE_COLORS[badge.category] || 'text-zinc-500';
        const isUnlocked = badge.unlocked === 1;

        return (
          <div key={badge.id} className="flex flex-col items-center gap-2 group">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                isUnlocked
                  ? 'bg-zinc-100 dark:bg-zinc-900'
                  : 'bg-zinc-800/30 dark:bg-zinc-900/50'
              }`}
            >
              <IconComp
                className={`w-5 h-5 transition-all ${
                  isUnlocked ? colorClass : 'text-zinc-700 opacity-30'
                }`}
              />
            </div>
            <span
              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-center leading-tight px-1 break-words max-w-full ${
                isUnlocked ? 'text-white' : 'text-zinc-700'
              }`}
            >
              {badge.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
