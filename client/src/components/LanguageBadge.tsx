'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { languageLabel } from '@/lib/languages';

interface LanguageBadgeProps {
  compact?: boolean;
}

export function LanguageBadge({ compact = false }: LanguageBadgeProps) {
  const { user } = useAuth();

  if (!user?.native_language || !user?.target_language) return null;

  const native = languageLabel(user.native_language);
  const target = languageLabel(user.target_language);
  const label = compact
    ? `${user.native_language}→${user.target_language}`
    : `${native} → ${target}`;

  return (
    <Link
      href="/settings"
      className="shrink-0 rounded-md border border-zinc-200 bg-zinc-100/80 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white sm:px-2 sm:text-[10px] sm:tracking-widest"
      title="Change languages in Settings"
    >
      {label}
    </Link>
  );
}
