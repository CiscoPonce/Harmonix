'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSyncEngine } from '../hooks/useSyncEngine';
import LyricList, { MappedVocabItem } from './LyricList';
import { Play, Pause, SkipBack, SkipForward, BookOpen, Settings, X } from 'lucide-react';
import { Button } from './ui/Button';
import { CefrSelector } from './CefrSelector';
import { VocabPopover } from './VocabPopover';
import { VocabItem } from '@/app/player/[id]/page';

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
  cefrLevel: string;
  onCefrChange: (level: string) => void;
}

const Player: React.FC<PlayerProps> = ({ 
  track, 
  lrcString, 
  mappedVocab = [], 
  unmappedVocab = [],
  cefrLevel,
  onCefrChange
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  
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
    <div className="flex flex-col h-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter truncate uppercase italic">{track.title}</h1>
          <p className="text-zinc-500 font-medium tracking-widest text-xs uppercase mt-1">{track.artist}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSidebar(!showSidebar)}
            className={showSidebar ? "text-white bg-zinc-800" : "text-zinc-500 hover:text-white"}
          >
            <BookOpen className="w-5 h-5" />
          </Button>
          <CefrSelector 
            currentLevel={cefrLevel} 
            onLevelChange={onCefrChange} 
            className="hidden md:flex"
          />
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
            mappedVocab={mappedVocab}
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
              <div className="md:hidden mb-4">
                <CefrSelector 
                  currentLevel={cefrLevel} 
                  onLevelChange={onCefrChange} 
                />
              </div>

              {unmappedVocab.length > 0 ? (
                <div className="grid gap-4">
                  {unmappedVocab.map((item) => (
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
