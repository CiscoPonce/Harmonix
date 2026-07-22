'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSyncEngine } from '../hooks/useSyncEngine';
import LyricList, { MappedVocabItem } from './LyricList';
import { Play, Pause, SkipBack, SkipForward, BookOpen, X, ArrowLeft, FolderPlus, Share2 } from 'lucide-react';
import { Button } from './ui/Button';
import { VocabPopover } from './VocabPopover';
import { VocabItem } from '@/app/player/[id]/page';
import { fetchSpotifyStatus, resolveSpotifyPlay } from '@/lib/api';
import { useSpotifyInAppPlayer } from '@/components/SpotifyInAppPlayer';
import { AddToPlaylistModal } from './AddToPlaylistModal';

interface TrackMetadata {
  id: number;
  title: string;
  artist: string;
  preview: string;
  duration: number;
  preview_offset: number;
}

interface PlayerProps {
  track: TrackMetadata;
  lrcString: string | null;
  mappedVocab?: MappedVocabItem[];
  unmappedVocab?: VocabItem[];
  cefrLevel?: string;
  onCefrChange?: (level: string) => void;
}

const Player: React.FC<PlayerProps> = ({ 
  track, 
  lrcString, 
  mappedVocab = [], 
  unmappedVocab = [],
  cefrLevel = 'B1',
  onCefrChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const handleShare = async () => {
    const songId = String(track?.id ?? '').trim();
    if (!songId || typeof window === 'undefined') return;
    // Canonical player deep link — avoid copying dashboard/query junk from location.href.
    const shareUrl = `${window.location.origin}/player/${encodeURIComponent(songId)}`;
    const shareText = `Listen to ${track.title} by ${track.artist} on Harmonix\n${shareUrl}`;

    const copyShareUrl = async () => {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${track.title} - ${track.artist}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await copyShareUrl();
    } catch {
      /* ignore */
    }
  };
  const [audioSource, setAudioSource] = useState<'spotify' | 'deezer' | 'pending'>('deezer');
  const [spotifyUri, setSpotifyUri] = useState<string | null>(null);
  const [songTimeSec, setSongTimeSec] = useState(0);
  const [spotifyDurationMs, setSpotifyDurationMs] = useState<number | null>(null);
  const spotifyPlayer = useSpotifyInAppPlayer();
  const songTimeRef = useRef(0);

  const getSongTimeMs = useCallback(() => {
    if (audioSource !== 'spotify') return null;
    return Math.round(songTimeRef.current * 1000);
  }, [audioSource]);

  const onSeekSongSeconds = useCallback(
    (songTimeSeconds: number) => {
      if (audioSource !== 'spotify' || !spotifyUri) return;
      void (async () => {
        try {
          await spotifyPlayer.seekMs(Math.max(0, songTimeSeconds * 1000));
          songTimeRef.current = songTimeSeconds;
          setSongTimeSec(songTimeSeconds);
          if (!isPlaying) {
            const ok = await spotifyPlayer.playTrack(spotifyUri, {
              positionMs: Math.max(0, songTimeSeconds * 1000),
            });
            if (ok) setIsPlaying(true);
          }
        } catch {
          setAudioError('Could not seek on Spotify.');
        }
      })();
    },
    [audioSource, isPlaying, spotifyPlayer, spotifyUri]
  );

  const { currentLineIndex, lines, seekTo } = useSyncEngine({
    lrcString,
    audioRef,
    offset: audioSource === 'spotify' ? 0 : track.preview_offset,
    getSongTimeMs: audioSource === 'spotify' ? getSongTimeMs : undefined,
    externalPlaying: audioSource === 'spotify' && isPlaying,
    onSeekSongSeconds: audioSource === 'spotify' ? onSeekSongSeconds : undefined,
  });

  // Prefer Spotify when connected; otherwise Deezer 30s preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchSpotifyStatus();
        if (cancelled) return;
        if (status.state === 'connected' && status.playback_scopes_ok !== false) {
          await spotifyPlayer.warmup();
          if (cancelled) return;
          const resolved = await resolveSpotifyPlay({
            title: track.title,
            artist: track.artist,
            song_id: String(track.id),
            duration_ms: track.duration > 0 ? Math.round(track.duration * 1000) : null,
          });
          if (cancelled) return;
          setSpotifyUri(resolved.uri);
          setAudioSource('spotify');
          return;
        }
      } catch {
        /* Deezer fallback */
      }
      if (!cancelled) {
        setSpotifyUri(null);
        setAudioSource('deezer');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.artist, track.duration, track.id, track.title]);

  // Poll Spotify position while playing.
  useEffect(() => {
    if (audioSource !== 'spotify' || !isPlaying) return;
    let alive = true;
    const tick = async () => {
      const snap = await spotifyPlayer.getPlaybackSnapshot();
      if (!alive || !snap) return;
      const sec = snap.position / 1000;
      songTimeRef.current = sec;
      setSongTimeSec(sec);
      if (snap.duration > 0) setSpotifyDurationMs(snap.duration);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 250);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [audioSource, isPlaying, spotifyPlayer]);

  useEffect(() => {
    if (audioSource === 'spotify' && spotifyPlayer.ui === 'playing') {
      setIsPlaying(true);
    }
    if (
      audioSource === 'spotify' &&
      (spotifyPlayer.ui === 'paused' || spotifyPlayer.ui === 'ready')
    ) {
      setIsPlaying(false);
    }
  }, [audioSource, spotifyPlayer.ui]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audioSource === 'spotify') return;

    const handleTimeUpdate = () => {
      setSongTimeSec(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [audioSource]);

  const togglePlay = async () => {
    if (audioSource === 'pending') return;
    spotifyPlayer.unlockAudio();

    if (audioSource === 'spotify' && spotifyUri) {
      if (isPlaying) {
        await spotifyPlayer.pausePlayback();
        setIsPlaying(false);
        return;
      }
      setAudioError(null);
      const ok = await spotifyPlayer.playTrack(spotifyUri, {
        positionMs: Math.round(songTimeRef.current * 1000),
      });
      if (ok) {
        setIsPlaying(true);
        return;
      }
      // Premium / reconnect / resolve failure → Deezer fallback.
      setAudioSource('deezer');
      setAudioError(
        spotifyPlayer.message ||
          'Spotify playback unavailable. Using Deezer 30s preview.'
      );
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      setAudioError(null);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      setIsPlaying(true);
    } catch (err) {
      console.error('Playback failed:', err);
      setAudioError('Playback failed: Audio preview unavailable.');
      setIsPlaying(false);
    }
  };

  const handleLineClick = (timeSeconds: number) => {
    seekTo(timeSeconds);
    if (audioSource === 'spotify') {
      setIsPlaying(true);
      return;
    }
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error("Playback failed during line click:", err);
        setAudioError("Playback failed: Audio preview unavailable.");
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const cefrIdx = CEFR_ORDER.indexOf(cefrLevel) >= 0 ? CEFR_ORDER.indexOf(cefrLevel) : 2;

  const activeMappedVocab = mappedVocab.filter((item) => {
    if (!item.cefr_level) return true;
    const idx = CEFR_ORDER.indexOf(item.cefr_level.toUpperCase());
    if (idx < 0) return true;
    return idx <= cefrIdx || Math.abs(idx - cefrIdx) <= 1;
  });

  const activeUnmappedVocab = unmappedVocab.filter((item) => {
    if (!item.cefr_level) return true;
    const idx = CEFR_ORDER.indexOf(item.cefr_level.toUpperCase());
    if (idx < 0) return true;
    return idx <= cefrIdx || Math.abs(idx - cefrIdx) <= 1;
  });

  const displayMapped = activeMappedVocab.length > 0 ? activeMappedVocab : mappedVocab;
  const displayUnmapped = activeUnmappedVocab.length > 0 ? activeUnmappedVocab : unmappedVocab;

  const progressDurationSec =
    audioSource === 'spotify'
      ? Math.max(1, (spotifyDurationMs ?? track.duration * 1000) / 1000 || 180)
      : 30;
  const progressCurrent =
    audioSource === 'spotify' ? songTimeSec : songTimeSec;

  const formatClock = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
            aria-label="Back to Learn"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-black tracking-tighter truncate uppercase italic">{track.title}</h1>
            <p className="text-zinc-500 font-medium tracking-widest text-xs uppercase mt-1">
              {track.artist}
              {audioSource === 'spotify' ? ' · Spotify' : audioSource === 'deezer' ? ' · Preview (30s)' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleShare()}
            className="text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 px-3.5 py-1.5 rounded-full transition-colors"
          >
            <Share2 className="w-4 h-4 text-sky-400" />
            <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddPlaylist(true)}
            className="text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 px-3.5 py-1.5 rounded-full transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-emerald-400" />
            <span>Add to my playlist</span>
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSidebar(!showSidebar)}
            className={showSidebar ? "text-white bg-zinc-800" : "text-zinc-500 hover:text-white"}
            aria-label="Toggle Words Sidebar"
          >
            <BookOpen className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Lyrics area */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-b from-black via-transparent to-black pointer-events-none z-10 h-32" />
          <LyricList 
            lines={lines} 
            currentLineIndex={currentLineIndex} 
            onLineClick={handleLineClick} 
            mappedVocab={displayMapped}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black via-transparent to-black pointer-events-none z-10 h-32" />
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 border-l border-zinc-900 bg-black animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-widest uppercase italic">Words in this song</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
              {displayUnmapped.length > 0 ? (
                <div className="grid gap-4">
                  {displayUnmapped.map((item) => (
                    <VocabPopover
                      key={item.vocab_id}
                      word={item.word}
                      lemma={item.lemma}
                      definition={item.definition}
                      cefrLevel={item.cefr_level}
                    >
                      <div className="group cursor-help p-3 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white group-hover:text-yellow-400 transition-colors">
                            {item.word}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded uppercase">
                            {item.cefr_level}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 line-clamp-2">
                          {item.definition}
                        </p>
                      </div>
                    </VocabPopover>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BookOpen className="w-8 h-8 text-zinc-800 mb-4" />
                  <p className="text-zinc-600 text-xs font-medium uppercase tracking-widest">
                    All target words are highlighted in lyrics
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 border-t border-zinc-900 bg-black/80 backdrop-blur-2xl relative z-20">
        {track.preview && (
          <audio 
            ref={audioRef} 
            src={track.preview} 
            preload="metadata"
            onPlay={() => {
              if (audioSource !== 'spotify') setIsPlaying(true);
            }}
            onPause={() => {
              if (audioSource !== 'spotify') setIsPlaying(false);
            }}
            onEnded={() => {
              if (audioSource !== 'spotify') setIsPlaying(false);
            }}
            onError={(e) => {
              if (audioSource === 'spotify') return;
              console.error("Audio preview load failed:", e);
              setAudioError("Audio preview unavailable in your region. You can still study the lyrics.");
            }}
          />
        )}
        
        <div className="flex justify-center items-center gap-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-500 hover:text-white transition-colors"
            onClick={() => {
              if (audioSource === 'spotify' && spotifyUri) {
                songTimeRef.current = 0;
                setSongTimeSec(0);
                void spotifyPlayer.playTrack(spotifyUri, { positionMs: 0 });
                setIsPlaying(true);
                return;
              }
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </Button>

          <Button 
            variant="primary" 
            size="icon" 
            className="w-20 h-20 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            onClick={() => void togglePlay()}
            disabled={audioSource === 'pending'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </Button>

          <Button variant="ghost" size="icon" disabled className="opacity-20">
            <SkipForward className="w-6 h-6" />
          </Button>
        </div>

        {/* Audio Error Alert */}
        {audioError && (
          <div className="max-w-xl mx-auto mb-4 p-3 bg-zinc-950 border border-red-950 rounded-lg text-[10px] text-zinc-400 flex items-center justify-between uppercase tracking-widest font-black animate-in fade-in duration-200">
            <span>{audioError}</span>
            <button 
              onClick={() => setAudioError(null)} 
              className="text-zinc-600 hover:text-white transition-colors text-[9px] font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {spotifyPlayer.message && audioSource === 'spotify' && (
          <p className="max-w-xl mx-auto mt-3 text-center text-[10px] text-zinc-500 uppercase tracking-widest">
            {spotifyPlayer.message}
          </p>
        )}

        {audioSource === 'deezer' && (
          <p className="max-w-xl mx-auto mt-3 text-center text-[10px] text-zinc-400 font-medium uppercase tracking-widest">
            30s Preview Mode ·{' '}
            <Link href="/settings" className="text-emerald-400 underline hover:text-emerald-300 font-bold">
              Connect Spotify in Settings
            </Link>{' '}
            for full track audio
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-8 max-w-xl mx-auto flex flex-col gap-2">
          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
             <div 
               className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
               style={{ width: `${Math.min(100, (progressCurrent / progressDurationSec) * 100)}%` }}
             />
          </div>
          <div className="flex justify-between text-[10px] font-bold tracking-tighter text-zinc-600 uppercase">
            <span>{formatClock(progressCurrent)}</span>
            <span>{formatClock(progressDurationSec)}</span>
          </div>
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={showAddPlaylist}
        onClose={() => setShowAddPlaylist(false)}
        track={track}
      />
    </div>
  );
};

export default Player;
