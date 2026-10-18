'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Music, 
  Sparkles, 
  CheckCircle2, 
  Activity,
  RefreshCw, 
  ShieldAlert,
  Loader2,
  Headphones
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { apiFetch, parseJsonResponse } from '@/lib/api';

interface AdminMetrics {
  total_users: number;
  active_users_7d: number;
  spotify_connected_count: number;
  spotify_connected_pct: number;
  total_words_learned: number;
  cards_served_7d: number;
  people_with_card_7d: number;
  one_sitting_14d: number;
  returned_14d: number;
  total_queue_ready: number;
  total_quizzes_completed: number;
  total_playlists_created: number;
  timestamp: string;
}

interface LatestCard {
  word: string | null;
  translation: string | null;
  song_title: string | null;
  song_artist: string | null;
  language_code: string | null;
}

interface UserRow {
  id: string;
  email: string;
  native_language: string | null;
  target_language: string;
  genre: string;
  voice_gender: string;
  is_admin: boolean;
  words_learned: number;
  cards_served: number;
  days_with_card: number;
  visit: 'none' | 'once' | 'same_day' | 'returned';
  last_card_at: string | null;
  latest_card: LatestCard | null;
  off_language_cards: number;
  queue_ready: number;
  spotify_connected: boolean;
  spotify_display_name: string | null;
  created_at: string;
}

function formatUk(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function visitLabel(visit: UserRow['visit']) {
  if (visit === 'returned') return 'Came back';
  if (visit === 'same_day') return 'Same day';
  if (visit === 'once') return 'One card';
  return 'No card';
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mResRaw, uResRaw] = await Promise.all([
        apiFetch('/admin/metrics'),
        apiFetch('/admin/users'),
      ]);
      if (!mResRaw.ok || !uResRaw.ok) {
        throw new Error('Admin access required or endpoint returned error');
      }
      const mRes = await parseJsonResponse<AdminMetrics>(mResRaw);
      const uRes = await parseJsonResponse<{ users: UserRow[] }>(uResRaw);
      setMetrics(mRes);
      setUsers(uRes.users || []);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setError(err.message || 'Failed to load admin metrics. Admin access required.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProfile = async () => {
    setSyncingProfile(true);
    setSyncMsg(null);
    try {
      const resRaw = await apiFetch('/user/sync-spotify-profile', {
        method: 'POST',
      });
      if (!resRaw.ok) throw new Error('Failed to sync profile');
      const res = await parseJsonResponse<{ synced: boolean; top_genres?: string[] }>(resRaw);
      if (res.synced) {
        setSyncMsg(`Synced profile! Genres: ${(res.top_genres || []).slice(0, 5).join(', ')}`);
      } else {
        setSyncMsg('Spotify not connected.');
      }
    } catch (err: any) {
      setSyncMsg(`Sync error: ${err.message}`);
    } finally {
      setSyncingProfile(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B4D2E] dark:text-[#3DCF7A]" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <div className="flex items-center gap-3 font-semibold">
              <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
              Access Denied
            </div>
            <p className="mt-2 text-sm">{error}</p>
            <Button onClick={() => router.push('/discover')} className="mt-4" variant="secondary">
              Return to Home
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0C1210] dark:text-[#F2F5F3] sm:text-3xl">
              Project Testing Dashboard
            </h1>
            <p className="mt-1 text-sm text-[#4E5D56] dark:text-[#A0B0A7]">
              Who came back, the card they saw, and whether that card matches the language they are learning.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSyncProfile}
              disabled={syncingProfile}
              variant="secondary"
              className="gap-2 text-sm"
            >
              {syncingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Headphones className="h-4 w-4 text-[#0B4D2E] dark:text-[#3DCF7A]" />
              )}
              Sync My Spotify Profile
            </Button>

            <Button onClick={loadData} variant="secondary" className="gap-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              Refresh Metrics
            </Button>
          </div>
        </div>

        {syncMsg && (
          <div className="rounded-xl border border-[#0B4D2E]/20 bg-[#0B4D2E]/5 p-4 text-sm text-[#0B4D2E] dark:border-[#3DCF7A]/20 dark:bg-[#3DCF7A]/10 dark:text-[#3DCF7A]">
            {syncMsg}
          </div>
        )}

        {/* Stats Grid */}
        {metrics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-sm dark:border-[#2A3530] dark:bg-[#171E1B]">
              <div className="flex items-center justify-between text-[#4E5D56] dark:text-[#A0B0A7]">
                <span className="text-sm font-medium">Total Registered Users</span>
                <Users className="h-5 w-5 text-[#0B4D2E] dark:text-[#3DCF7A]" />
              </div>
              <div className="mt-3 text-3xl font-bold text-[#0C1210] dark:text-[#F2F5F3]">
                {metrics.total_users}
              </div>
              <p className="mt-1 text-xs text-[#4E5D56] dark:text-[#A0B0A7]">
                {metrics.active_users_7d} active in last 7 days
              </p>
            </div>

            <div className="rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-sm dark:border-[#2A3530] dark:bg-[#171E1B]">
              <div className="flex items-center justify-between text-[#4E5D56] dark:text-[#A0B0A7]">
                <span className="text-sm font-medium">Spotify Premium Connected</span>
                <Music className="h-5 w-5 text-[#1DB954]" />
              </div>
              <div className="mt-3 text-3xl font-bold text-[#0C1210] dark:text-[#F2F5F3]">
                {metrics.spotify_connected_pct}%
              </div>
              <p className="mt-1 text-xs text-[#4E5D56] dark:text-[#A0B0A7]">
                {metrics.spotify_connected_count} connected accounts
              </p>
            </div>

            <div className="rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-sm dark:border-[#2A3530] dark:bg-[#171E1B]">
              <div className="flex items-center justify-between text-[#4E5D56] dark:text-[#A0B0A7]">
                <span className="text-sm font-medium">Cards served, 7 days</span>
                <Sparkles className="h-5 w-5 text-[#0B4D2E] dark:text-[#3DCF7A]" />
              </div>
              <div className="mt-3 text-3xl font-bold text-[#0C1210] dark:text-[#F2F5F3]">
                {metrics.cards_served_7d}
              </div>
              <p className="mt-1 text-xs text-[#4E5D56] dark:text-[#A0B0A7]">
                {metrics.people_with_card_7d} people received a card
              </p>
            </div>

            <div className="rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-sm dark:border-[#2A3530] dark:bg-[#171E1B]">
              <div className="flex items-center justify-between text-[#4E5D56] dark:text-[#A0B0A7]">
                <span className="text-sm font-medium">Came back, 14 days</span>
                <Activity className="h-5 w-5 text-[#0B4D2E] dark:text-[#3DCF7A]" />
              </div>
              <div className="mt-3 text-3xl font-bold text-[#0C1210] dark:text-[#F2F5F3]">
                {metrics.returned_14d}
              </div>
              <p className="mt-1 text-xs text-[#4E5D56] dark:text-[#A0B0A7]">
                {metrics.one_sitting_14d} left after one sitting
              </p>
            </div>
          </div>
        )}

        {/* User Oversight Table */}
        <div className="rounded-2xl border border-[#E4EBE6] bg-white p-6 shadow-sm dark:border-[#2A3530] dark:bg-[#171E1B]">
          <h2 className="text-lg font-semibold text-[#0C1210] dark:text-[#F2F5F3]">
            Beta Testers Oversight ({users.length})
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-[#0C1210] dark:text-[#F2F5F3]">
              <thead className="border-b border-[#E4EBE6] bg-[#F7F8F6] text-xs font-semibold uppercase text-[#4E5D56] dark:border-[#2A3530] dark:bg-[#121A17] dark:text-[#A0B0A7]">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Learning</th>
                  <th className="px-4 py-3">Cards</th>
                  <th className="px-4 py-3">Last card</th>
                  <th className="px-4 py-3">Visit</th>
                  <th className="px-4 py-3">Latest word</th>
                  <th className="px-4 py-3">Song</th>
                  <th className="px-4 py-3">Spotify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EBE6] dark:divide-[#2A3530]">
                {users.map((u) => {
                  const card = u.latest_card;
                  const wordLine = card?.word
                    ? `${card.word}${card.translation ? ` → ${card.translation}` : ''}`
                    : '—';
                  const songLine = [card?.song_title, card?.song_artist].filter(Boolean).join(' — ');
                  const cardLang = card?.language_code?.toLowerCase();
                  const targetLang = u.target_language?.toLowerCase();
                  const latestMismatch = Boolean(cardLang && targetLang && cardLang !== targetLang);
                  return (
                  <tr key={u.id} className="hover:bg-[#F7F8F6] dark:hover:bg-[#121A17]">
                    <td className="px-4 py-3 font-medium">
                      {u.email} {u.is_admin && <span className="ml-1.5 rounded bg-[#0B4D2E]/10 px-1.5 py-0.5 text-xs text-[#0B4D2E] dark:bg-[#3DCF7A]/20 dark:text-[#3DCF7A]">Admin</span>}
                    </td>
                    <td className="px-4 py-3 uppercase">
                      {(u.native_language || '—')} → {u.target_language}
                      <div className="mt-0.5 text-xs capitalize normal-case text-[#4E5D56] dark:text-[#A0B0A7]">{u.genre}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{u.cards_served}</span>
                      <div className="text-xs text-[#4E5D56] dark:text-[#A0B0A7]">{u.queue_ready} waiting</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4E5D56] dark:text-[#A0B0A7]">
                      {formatUk(u.last_card_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        u.visit === 'returned'
                          ? 'text-xs font-medium text-[#0B4D2E] dark:text-[#3DCF7A]'
                          : u.visit === 'once'
                            ? 'text-xs font-medium text-amber-700 dark:text-amber-400'
                            : 'text-xs text-[#4E5D56] dark:text-[#A0B0A7]'
                      }>
                        {visitLabel(u.visit)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{wordLine}</div>
                      {latestMismatch && (
                        <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                          Card is {cardLang}. Account learns {targetLang}.
                        </div>
                      )}
                      {!latestMismatch && u.off_language_cards > 0 && (
                        <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                          {u.off_language_cards} card{u.off_language_cards === 1 ? '' : 's'} in another language
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4E5D56] dark:text-[#A0B0A7]">
                      {songLine || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.spotify_connected ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1DB954]">
                          <CheckCircle2 className="h-4 w-4" />
                          {u.spotify_display_name || 'Connected'}
                        </span>
                      ) : (
                        <span className="text-xs text-[#A0B0A7]">Not connected</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
