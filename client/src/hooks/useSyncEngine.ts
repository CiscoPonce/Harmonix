import { useEffect, useRef, useState, RefObject } from 'react';
import Lyric from 'lrc-file-parser';

interface SyncEngineProps {
  lrcString: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  offset?: number; // In seconds
}

export function useSyncEngine({ lrcString, audioRef, offset = 0 }: SyncEngineProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [lines, setLines] = useState<any[]>([]);
  const lyricRef = useRef<Lyric | null>(null);

  useEffect(() => {
    if (!lrcString) return;

    const lyric = new Lyric({
      onPlay: (line: any, index: number) => {
        setCurrentLineIndex(index);
      },
      onStatusChange: (status: any) => {
        // console.log('Lyric status:', status);
      }
    });

    lyric.setLrc(lrcString);
    lyricRef.current = lyric;
    setLines(lyric.getLines() || []);

    return () => {
      // Cleanup if needed
      lyricRef.current = null;
    };
  }, [lrcString]);

  return {
    currentLineIndex,
    lines,
  };
}
