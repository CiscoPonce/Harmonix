'use client';

import Link from 'next/link';
import { BookOpen, Award, ListMusic } from 'lucide-react';
import { BadgeGrid } from '@/components/BadgeGrid';

type PlaylistSummary = {
  id: string;
  name: string;
  song_count: number;
};

interface DashboardMatureCardsProps {
  loadingData: boolean;
  playlists: PlaylistSummary[];
  onScrollToDailyWord: () => void;
}

export function DashboardMatureCards({
  loadingData,
  playlists,
  onScrollToDailyWord,
}: DashboardMatureCardsProps) {
  return (
    <>
      <div
        onClick={onScrollToDailyWord}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-5 sm:p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group cursor-pointer flex flex-col min-h-[250px] min-w-0 overflow-hidden"
      >
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="font-black uppercase sm:italic tracking-tight text-xl mb-2 shrink-0 pl-0.5">Daily</h3>
        <p className="text-sm text-zinc-500 font-medium normal-case sm:uppercase tracking-normal sm:tracking-widest leading-relaxed flex-1">
          One word, one song, one lyric moment — every day.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-5 sm:p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px] min-w-0 overflow-hidden">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
          <Award className="w-6 h-6" />
        </div>
        <h3 className="font-black uppercase sm:italic tracking-tight text-xl mb-2 shrink-0 pl-0.5">Achievements</h3>
        <div className="flex-1">
          <BadgeGrid />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-5 sm:p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px] min-w-0 overflow-hidden">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
          <ListMusic className="w-6 h-6" />
        </div>
        <h3 className="font-black uppercase sm:italic tracking-tight text-xl mb-2 shrink-0 pl-0.5">Playlists</h3>
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
                <span className="text-[10px] text-zinc-500 font-bold shrink-0 ml-2">
                  {pl.song_count} {pl.song_count === 1 ? 'song' : 'songs'}
                </span>
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
          <p className="text-sm text-zinc-500 font-medium normal-case sm:uppercase tracking-normal sm:tracking-widest leading-relaxed flex-1">
            Your collection is empty.{' '}
            <Link href="/" className="underline underline-offset-4 hover:text-white">Explore songs</Link>
          </p>
        )}
      </div>
    </>
  );
}
