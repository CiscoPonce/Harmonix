'use client';

import Link from 'next/link';
import { LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';
import { LanguageBadge } from '@/components/LanguageBadge';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppHeaderProps {
  userEmail?: string;
  onLogout?: () => void;
  homeHref?: string;
  showSettingsLink?: boolean;
}

export function AppHeader({
  userEmail,
  onLogout,
  homeHref = '/discover',
  showSettingsLink = true,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-xl dark:border-zinc-900 dark:bg-black/90">
      <div
        className="mx-auto flex h-14 w-full max-w-5xl flex-row flex-nowrap items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <HarmonixWordmark href={homeHref} linkClassName="min-w-0 max-w-[42vw] sm:max-w-none" />

        <div className="flex shrink-0 flex-row flex-nowrap items-center gap-1.5 sm:gap-2.5">
          <LanguageBadge compact />
          <ThemeToggle />
          {userEmail ? (
            <div className="hidden min-w-0 lg:flex lg:flex-col lg:items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Logged in as
              </span>
              <span className="max-w-[12rem] truncate text-xs font-bold">{userEmail}</span>
            </div>
          ) : null}
          {showSettingsLink ? (
            <Link
              href="/settings"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900 sm:h-8 sm:w-auto sm:gap-1.5 sm:px-3"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden text-[10px] font-bold uppercase tracking-widest sm:inline">
                Settings
              </span>
            </Link>
          ) : null}
          {onLogout ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              className="h-9 w-9 shrink-0 p-0 sm:h-8 sm:w-auto sm:px-3"
              title="Logout"
            >
              <LogOut className="h-4 w-4 sm:hidden" />
              <span className="hidden text-[10px] font-bold uppercase tracking-widest sm:inline">
                Logout
              </span>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
