'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Player from '@/components/Player';
import { apiFetch, parseJsonResponse } from '@/lib/api';
import { MappedVocabItem } from '@/components/LyricList';

interface TrackMetadata {
  id: number;
  title: string;
  artist: string;
  preview: string;
  duration: number;
  preview_offset: number;
  cover?: string | null;
}

export interface VocabItem {
  vocab_id: string;
  word: string;
  lemma?: string;
  definition: string;
  cefr_level: string;
}

export default function PlayerPage() {
  const params = useParams();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const id = rawId ? decodeURIComponent(rawId) : '';
  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [lrcString, setLrcString] = useState<string | null>(null);
  const [mappedVocab, setMappedVocab] = useState<MappedVocabItem[]>([]);
  const [unmappedVocab, setUnmappedVocab] = useState<VocabItem[]>([]);
  const [cefrLevel, setCefrLevel] = useState<string>('B1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Missing track id');
      return;
    }

    let active = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const trackRes = await apiFetch(`/tracks/${encodeURIComponent(id)}`);
        if (!trackRes.ok) {
          const body = await trackRes.json().catch(() => ({}));
          throw new Error(
            (body && typeof body.error === 'string' && body.error) ||
              `Track not found (${trackRes.status})`
          );
        }
        const trackData = await parseJsonResponse<TrackMetadata>(trackRes);
        if (!active) return;
        setTrack(trackData);

        const lyricsRes = await apiFetch(
          `/lyrics?artist_name=${encodeURIComponent(trackData.artist)}&track_name=${encodeURIComponent(trackData.title)}&duration=${trackData.duration}`
        );
        if (lyricsRes.ok) {
          const lyricsData = await parseJsonResponse<{ syncedLyrics?: string }>(lyricsRes);
          if (active) setLrcString(lyricsData.syncedLyrics ?? null);
        }

        const vocabRes = await apiFetch(`/vocab/${encodeURIComponent(id)}`);
        if (vocabRes.ok) {
          const vocabData = await parseJsonResponse<{
            mapped?: MappedVocabItem[];
            unmapped?: VocabItem[];
            synced_lyrics?: string;
          }>(vocabRes);
          if (!active) return;
          setMappedVocab(vocabData.mapped || []);
          setUnmappedVocab(vocabData.unmapped || []);
          if (vocabData.synced_lyrics) {
            setLrcString(vocabData.synced_lyrics);
          }
        }

        const userRes = await apiFetch('/auth/me');
        if (userRes.ok) {
          const userData = await parseJsonResponse<{ cefr_level?: string }>(userRes);
          if (active && userData.cefr_level) {
            setCefrLevel(userData.cefr_level);
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setTrack(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      active = false;
    };
  }, [id]);

  const handleCefrChange = async (newLevel: string) => {
    setCefrLevel(newLevel);
    try {
      await apiFetch('/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ cefr_level: newLevel }),
      });
      const vocabRes = await apiFetch(`/vocab/${encodeURIComponent(id)}`);
      if (vocabRes.ok) {
        const vocabData = await parseJsonResponse<{
          mapped?: MappedVocabItem[];
          unmapped?: VocabItem[];
          synced_lyrics?: string;
        }>(vocabRes);
        setMappedVocab(vocabData.mapped || []);
        setUnmappedVocab(vocabData.unmapped || []);
      }
    } catch (err) {
      console.error('Failed to update CEFR preference:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold tracking-widest uppercase opacity-50">Loading Experience</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <h2 className="text-2xl font-black uppercase italic mb-2">Error</h2>
        <p className="text-zinc-500 max-w-xs">{error}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2 border border-white text-xs font-bold uppercase hover:bg-white hover:text-black transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/discover"
            className="px-6 py-2 border border-zinc-600 text-xs font-bold uppercase text-zinc-300 hover:border-white hover:text-white transition-colors"
          >
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4 uppercase font-black italic">
        <p>Track Not Found</p>
        <Link href="/discover" className="text-xs font-bold tracking-widest text-zinc-400 hover:text-white not-italic">
          Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <Player
      track={track}
      lrcString={lrcString}
      mappedVocab={mappedVocab}
      unmappedVocab={unmappedVocab}
    />
  );
}
