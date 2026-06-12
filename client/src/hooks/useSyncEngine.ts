import { useEffect, useRef, useState, RefObject } from 'react';
import Lyric from 'lrc-file-parser';

interface LyricLine {
  time: number;
  text: string;
}

interface SyncEngineProps {
  lrcString: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  offset?: number; // In seconds
  latencyCompensationMs?: number;
}

export function useSyncEngine({ 
  lrcString, 
  audioRef, 
  offset = 0,
  latencyCompensationMs = -150 
}: SyncEngineProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const lyricRef = useRef<Lyric | null>(null);
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!lrcString) return;

    const lyric = new Lyric({
      onPlay: (_line: any, index: number) => {
        setCurrentLineIndex(index);
      },
    });

    lyric.setLrc(lrcString);
    lyricRef.current = lyric;
    setLines(lyric.getLines() || []);

    return () => {
      lyricRef.current = null;
    };
  }, [lrcString]);

  useEffect(() => {
    const animate = () => {
      const audio = audioRef.current;
      const lyric = lyricRef.current;

      if (audio && lyric && !audio.paused) {
        const adjustedTimeMs = (audio.currentTime * 1000) + (offset * 1000) + latencyCompensationMs;
        lyric.play(adjustedTimeMs);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== undefined) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [audioRef, offset, latencyCompensationMs]);

  const seekTo = (targetLyricTimeSeconds: number) => {
    const audio = audioRef.current;
    const lyric = lyricRef.current;
    if (!audio || !lyric) return;

    // targetAudioTime = targetLyricTime - offset
    const targetAudioTime = targetLyricTimeSeconds - offset;
    
    // Clamp between 0 and 30 seconds (snippet duration)
    const clampedTargetAudioTime = Math.max(0, Math.min(30, targetAudioTime));
    
    audio.currentTime = clampedTargetAudioTime;
    
    // Sync the parser state immediately
    const adjustedTimeMs = (clampedTargetAudioTime * 1000) + (offset * 1000) + latencyCompensationMs;
    lyric.play(adjustedTimeMs);
  };

  return {
    currentLineIndex,
    lines,
    seekTo,
  };
}
