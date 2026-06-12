'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Player from '@/components/Player';
import { apiFetch } from '@/lib/api';
import { MappedVocabItem } from '@/components/LyricList';

interface TrackMetadata {
  id: number;
  title: string;
  artist: string;
  preview: string;
  duration: number;
  preview_offset: number;
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
  const id = params.id as string;
  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [lrcString, setLrcString] = useState<string | null>(null);
  const [mappedVocab, setMappedVocab] = useState<MappedVocabItem[]>([]);
  const [unmappedVocab, setUnmappedVocab] = useState<VocabItem[]>([]);
  const [cefrLevel, setCefrLevel] = useState<string>('B1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      try {
        setLoading(true);
        const trackRes = await apiFetch(`/tracks/${id}`);
        if (!trackRes.ok) throw new Error('Track not found');
        const trackData = await trackRes.json();
        setTrack(trackData);

        const lyricsRes = await apiFetch(
          `/lyrics?artist_name=${encodeURIComponent(trackData.artist)}&track_name=${encodeURIComponent(trackData.title)}&duration=${trackData.duration}`
        );
        if (lyricsRes.ok) {
          const lyricsData = await lyricsRes.json();
          setLrcString(lyricsData.syncedLyrics);
        } else {
          console.warn('Lyrics not found for this track');
        }

        // Fetch vocabulary
        const vocabRes = await apiFetch(`/vocab/${id}`);
        if (vocabRes.ok) {
          const vocabData = await vocabRes.json();
          setMappedVocab(vocabData.mapped);
          setUnmappedVocab(vocabData.unmapped);
        }

        // Fetch user profile for CEFR level
        const userRes = await apiFetch('/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.cefr_level) {
            setCefrLevel(userData.cefr_level);
          }
        }

      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleCefrChange = async (newLevel: string) => {
    setCefrLevel(newLevel);
    // Future: Persistence to backend
    // await apiFetch('/user/profile', { 
    //   method: 'PUT', 
    //   body: JSON.stringify({ cefr_level: newLevel }) 
    // });
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
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-2 border border-white text-xs font-bold uppercase hover:bg-white hover:text-black transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white uppercase font-black italic">
        Track Not Found
      </div>
    );
  }

  return (
    <Player 
      track={track} 
      lrcString={lrcString} 
      mappedVocab={mappedVocab}
      unmappedVocab={unmappedVocab}
      cefrLevel={cefrLevel}
      onCefrChange={handleCefrChange}
    />
  );
}
