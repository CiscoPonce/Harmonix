'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export function LanguageBadge() {
  const { user } = useAuth();

  if (!user?.native_language || !user?.target_language) return null;

  return (
    <Link
      href="/settings"
      className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-zinc-800 bg-black/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
    >
      {user.native_language} → {user.target_language}
    </Link>
  );
}
