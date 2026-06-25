'use client';

import { useEffect, useState } from 'react';
import { Flame, BookOpen, Award, ListMusic, CalendarDays, X } from 'lucide-react';

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

interface BadgeUnlockToastProps {
  badge: { id: string; name: string; icon?: string; category?: string } | null;
  onDismiss: () => void;
}

export function BadgeUnlockToast({ badge, onDismiss }: BadgeUnlockToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (badge) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [badge, onDismiss]);

  if (!badge || !visible) return null;

  const IconComp = BADGE_ICONS[badge.icon || ''] || Award;
  const colorClass = BADGE_COLORS[badge.category || ''] || 'text-zinc-500';

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="rounded-xl border border-zinc-800 bg-black/90 backdrop-blur-xl p-4 shadow-2xl flex items-center gap-3 min-w-[240px]">
        <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
          <IconComp className={`w-5 h-5 ${colorClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-white truncate">
            {badge.name} unlocked!
          </p>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
          className="shrink-0 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
