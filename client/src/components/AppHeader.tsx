'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';
import { LanguageBadge } from '@/components/LanguageBadge';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppHeaderProps {
  userEmail?: string;
  onLogout?: () => void;
  homeHref?: string;
}

export function AppHeader({
  userEmail,
  onLogout,
  homeHref = '/dashboard',
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
