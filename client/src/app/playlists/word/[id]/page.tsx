'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { DailyWordCard } from '@/components/DailyWordCard';
import type { DailyWordPayload } from '@/lib/dailyWordPayload';
import { apiFetch, parseJsonResponse } from '@/lib/api';
import {
  recentSummaryToDailyPayload,
  type RecentWordSummary,
} from '@/lib/recentWordPayload';
import { useTranslation } from '@/lib/i18n';

export default function SavedWordPage() {
  const params = useParams();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const { t } = useTranslation();
  const [payload, setPayload] = useState<DailyWordPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawId) {
      setLoading(false);
      setError('Missing word id');
      return;
    }

    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/daily-word/saved/${encodeURIComponent(rawId)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body && typeof body.error === 'string' && body.error) || 'Word not found'
          );
        }
        const data = await parseJsonResponse<{ entry: RecentWordSummary }>(res);
        if (!active) return;
        const mapped = recentSummaryToDailyPayload(data.entry);
        if (!mapped) {
          throw new Error('Could not load this word');
        }
        setPayload(mapped);
      } catch (err) {
        if (!active) return;
        setPayload(null);
        setError(err instanceof Error ? err.message : 'Could not load this word');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [rawId]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <Link
          href="/playlists"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#5C6B62] hover:text-[#0B6B3A] dark:text-[#9AABA0] dark:hover:text-[#3DCF7A]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('nav_shelf')}
        </Link>

        {loading ? (
          <div className="flex justify-center py-16" aria-busy="true">
            <Loader2 className="h-8 w-8 animate-spin text-[#0B6B3A] dark:text-[#3DCF7A]" />
          </div>
        ) : error || !payload ? (
          <p className="text-center text-sm text-[#5C6B62] dark:text-[#9AABA0]">
            {error || t('no_word_available')}
          </p>
        ) : (
          <DailyWordCard staticPayload={payload} savedView />
        )}
      </div>
    </AppShell>
  );
}
