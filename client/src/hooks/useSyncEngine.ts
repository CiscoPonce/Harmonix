import { useEffect, useRef, useState, RefObject } from 'react';
import Lyric from 'lrc-file-parser';

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
  const [lines, setLines] = useState<any[]>([]);
  const lyricRef = useRef<Lyric | null>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    if (!lrcString) return;

    const lyric = new Lyric({
      onPlay: (line: any, index: number) => {
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
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [audioRef, offset, latencyCompensationMs]);

  return {
    currentLineIndex,
    lines,
  };
}
