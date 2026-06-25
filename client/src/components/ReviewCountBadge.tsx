'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

export function ReviewCountBadge() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchDueCount() {
      try {
        const res = await apiFetch('/progress/due?limit=1');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        } else {
          setCount(0);
        }
      } catch {
        if (active) setCount(0);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchDueCount();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!count || count === 0) return null;

  return (
    <div className="flex justify-center py-4">
      <Link
        href="/review"
        className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
      >
        {count} {count === 1 ? 'word' : 'words'} to review today →
      </Link>
    </div>
  );
}
