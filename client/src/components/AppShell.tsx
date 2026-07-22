'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Library,
  Settings,
  Search,
  Bell,
  User,
  LogOut,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';

const NAV = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/playlists', label: 'Library', icon: Library },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export interface AppShellProps {
  children: ReactNode;
  userEmail?: string | null;
  onLogout?: () => void;
  searchPlaceholder?: string;
  pageTitle?: string;
  showBottomPlayer?: boolean;
  nowPlaying?: { title: string; artist: string } | null;
  headerExtra?: ReactNode;
}

export function AppShell({
  children,
  userEmail,
  onLogout,
  searchPlaceholder = 'Search for tracks, lyrics, or definitions...',
  pageTitle,
  showBottomPlayer = false,
  nowPlaying = null,
  headerExtra,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#F7F8F6] text-[#0C1210] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
      {/* Sidebar — fixed full viewport height so the column bar always reaches the bottom */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-[#E4EBE6] bg-white px-5 py-6 dark:border-[#2A3530] dark:bg-[#121A17] lg:flex">
        <div className="mb-8 shrink-0">
          <HarmonixWordmark href="/discover" size="lg" showTagline />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === '/playlists' && pathname.startsWith('/playlists'));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-[#E8F5EE] text-[#0B4D2E] dark:bg-[#0B4D2E]/35 dark:text-[#3DCF7A]'
                    : 'text-[#5C6B62] hover:bg-[#F4F7F5] hover:text-[#0C1210] dark:text-[#9AABA0] dark:hover:bg-[#1A2420] dark:hover:text-[#F2F5F3]'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {label}
                {active ? (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0B4D2E] dark:bg-[#3DCF7A]"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 pt-6">
          {nowPlaying ? (
            <div className="rounded-2xl bg-[#E8F5EE] p-4 dark:bg-[#0B4D2E]/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0B4D2E] dark:text-[#3DCF7A]">
                Now playing
              </p>
              <p className="mt-1 truncate text-sm font-bold text-[#0C1210] dark:text-[#F2F5F3]">
                {nowPlaying.title}
              </p>
              <p className="truncate text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                {nowPlaying.artist}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-[#E8F5EE] to-[#D7EDE0] p-4 dark:from-[#0B4D2E]/40 dark:to-[#163D2A]">
              <p className="text-sm font-bold text-[#0B4D2E] dark:text-[#3DCF7A]">Pro Plan</p>
              <p className="mt-1 text-xs leading-relaxed text-[#3D5A4A] dark:text-[#9AABA0]">
                Unlock advanced linguistic analysis and offline modes.
              </p>
              <button
                type="button"
                className="mt-3 w-full rounded-full bg-[#0B4D2E] px-3 py-2 text-xs font-bold text-white hover:bg-[#093F25] dark:bg-[#3DCF7A] dark:text-[#0C1210] dark:hover:bg-[#2FB86A]"
              >
                Upgrade
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main column — offset for fixed sidebar on desktop */}
      <div className="flex min-w-0 min-h-screen flex-1 flex-col lg:pl-[240px]">
        <header className="sticky top-0 z-30 border-b border-[#E4EBE6] bg-[#F7F8F6]/90 backdrop-blur-xl dark:border-[#2A3530] dark:bg-[#0C1210]/90">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="shrink-0 lg:hidden">
              <HarmonixWordmark href="/discover" size="sm" />
            </div>

            {pageTitle ? (
              <h1 className="font-display hidden text-2xl font-bold italic text-[#0B4D2E] dark:text-[#3DCF7A] sm:block">
                {pageTitle}
              </h1>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input');
                if (input && input.value.trim()) {
                  window.location.href = `/discover?q=${encodeURIComponent(input.value.trim())}`;
                }
              }}
              className="relative mx-auto hidden w-full max-w-xl flex-1 md:block"
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8A80]"
                aria-hidden
              />
              <input
                type="search"
                placeholder={searchPlaceholder}
                className="h-11 w-full rounded-full border border-[#E4EBE6] bg-white py-2 pl-10 pr-4 text-sm text-[#0C1210] placeholder:text-[#9AABA0] focus:border-[#0B4D2E] focus:outline-none focus:ring-2 focus:ring-[#0B4D2E]/20 dark:border-[#2A3530] dark:bg-[#171E1B] dark:text-[#F2F5F3] dark:focus:border-[#3DCF7A] dark:focus:ring-[#3DCF7A]/20"
                aria-label="Search"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-[#5C6B62] hover:bg-white dark:text-[#9AABA0] dark:hover:bg-[#171E1B] sm:inline-flex"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              <Link
                href="/settings"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B4D2E] text-white dark:bg-[#3DCF7A] dark:text-[#0C1210]"
                title={userEmail || 'Account settings'}
                aria-label="Account settings"
              >
                <User className="h-5 w-5" aria-hidden />
              </Link>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5C6B62] hover:bg-white dark:text-[#9AABA0] dark:hover:bg-[#171E1B]"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>

          <nav
            className="flex gap-1 overflow-x-auto border-t border-[#E4EBE6] px-2 py-2 dark:border-[#2A3530] lg:hidden"
            aria-label="Mobile"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href === '/playlists' && pathname.startsWith('/playlists'));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                    active
                      ? 'bg-[#0B4D2E] text-white dark:bg-[#3DCF7A] dark:text-[#0C1210]'
                      : 'bg-white text-[#5C6B62] ring-1 ring-[#E4EBE6] dark:bg-[#171E1B] dark:text-[#9AABA0] dark:ring-[#2A3530]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className={cn('flex-1 px-4 py-6 sm:px-6 lg:px-8', showBottomPlayer && 'pb-28')}>
          {children}
        </main>

        <footer className="mt-auto border-t border-[#E4EBE6] bg-[#EEF2EF] px-4 py-4 dark:border-[#2A3530] dark:bg-[#121A17] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#5C6B62] dark:text-[#9AABA0]">
              <span className="font-display font-bold text-[#0B4D2E] dark:text-[#3DCF7A]">
                Harmonix
              </span>
              {' · '}© {new Date().getFullYear()} Harmonix. Resonance in Language.
            </p>
            <div className="flex gap-4 text-xs font-semibold text-[#5C6B62] dark:text-[#9AABA0]">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Contact</span>
            </div>
          </div>
        </footer>

        {showBottomPlayer && nowPlaying ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E4EBE6] bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-[#2A3530] dark:bg-[#121A17]/95 sm:px-6">
            <div className="mx-auto flex max-w-5xl items-center gap-4">
              <div
                className="h-12 w-12 shrink-0 rounded-lg bg-[#E8F5EE] dark:bg-[#0B4D2E]/40"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{nowPlaying.title}</p>
                <p className="truncate text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                  {nowPlaying.artist}
                </p>
              </div>
              <p className="hidden text-xs text-[#7A8A80] dark:text-[#9AABA0] sm:block">
                Preview via Deezer · Spotify in-app when connected (Premium)
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
