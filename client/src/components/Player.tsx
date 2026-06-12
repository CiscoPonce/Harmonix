'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSyncEngine } from '../hooks/useSyncEngine';
import LyricList from './LyricList';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/Button';

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
}

const Player: React.FC<PlayerProps> = ({ track, lrcString }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const { currentLineIndex, lines, seekTo } = useSyncEngine({
    lrcString,
    audioRef,
    offset: track.preview_offset,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleLineClick = (timeSeconds: number) => {
    seekTo(timeSeconds);
    if (audioRef.current && !isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* Header */}
      <div className="p-6 text-center border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-black tracking-tighter truncate uppercase italic">{track.title}</h1>
        <p className="text-zinc-500 font-medium tracking-widest text-xs uppercase mt-1">{track.artist}</p>
      </div>

      {/* Lyrics area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-linear-to-b from-black via-transparent to-black pointer-events-none z-10 h-32" />
        <LyricList 
          lines={lines} 
          currentLineIndex={currentLineIndex} 
          onLineClick={handleLineClick} 
        />
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black via-transparent to-black pointer-events-none z-10 h-32" />
      </div>

      {/* Controls */}
      <div className="p-8 border-t border-zinc-900 bg-black/80 backdrop-blur-2xl">
        <audio 
          ref={audioRef} 
          src={track.preview} 
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        
        <div className="flex justify-center items-center gap-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-500 hover:text-white transition-colors"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </Button>

          <Button 
            variant="primary" 
            size="icon" 
            className="w-20 h-20 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            onClick={togglePlay}
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

        {/* Progress bar */}
        <div className="mt-8 max-w-xl mx-auto flex flex-col gap-2">
          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
             <div 
               className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
               style={{ width: `${(currentTime / 30) * 100}%` }}
             />
          </div>
          <div className="flex justify-between text-[10px] font-bold tracking-tighter text-zinc-600 uppercase">
            <span>0:{Math.floor(currentTime).toString().padStart(2, '0')}</span>
            <span>0:30</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
