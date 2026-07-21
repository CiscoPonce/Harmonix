import { useEffect, useRef, useState, RefObject } from 'react';
import Lyric, { Lines } from 'lrc-file-parser';

interface LyricLine {
  time: number;
  text: string;
}

interface SyncEngineProps {
  lrcString: string | null;
  audioRef?: RefObject<HTMLAudioElement | null>;
  /** Absolute song position in ms (Spotify full-track path). When set, preferred over audioRef. */
  getSongTimeMs?: () => number | null;
  /** When using getSongTimeMs, whether lyrics should advance. */
  externalPlaying?: boolean;
  /** Override seek (e.g. Spotify seek). Receives absolute lyric time in seconds. */
  onSeekSongSeconds?: (songTimeSeconds: number) => void;
  offset?: number; // In seconds (Deezer preview window start in full song)
  latencyCompensationMs?: number;
  /** Max relative audio seek window for Deezer preview (seconds). Ignored for Spotify path. */
  maxAudioSeconds?: number;
}

export function useSyncEngine({
  lrcString,
  audioRef,
  getSongTimeMs,
  externalPlaying = false,
  onSeekSongSeconds,
  offset = 0,
  latencyCompensationMs = -150,
  maxAudioSeconds = 30,
}: SyncEngineProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const lyricRef = useRef<Lyric | null>(null);
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!lrcString) return;

    const lyric = new Lyric({
      onPlay: (line: number) => {
        setCurrentLineIndex(line);
      },
      onSetLyric: (parsed: Lines) => {
        setLines(
          (parsed || []).map((l) => ({ time: l.time, text: l.text }))
        );
      },
    });

    try {
      lyric.setLyric(lrcString);
      lyricRef.current = lyric;
      /* eslint-disable react-hooks/set-state-in-effect */
      if (Array.isArray(lyric.lines) && lyric.lines.length > 0) {
        setLines(lyric.lines.map((l) => ({ time: l.time, text: l.text })));
      }
    } catch (error) {
      console.error('Failed to parse LRC string:', error);
      setLines([]);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      lyricRef.current = null;
    };
  }, [lrcString]);

  useEffect(() => {
    const animate = () => {
      const lyric = lyricRef.current;
      if (!lyric) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      if (getSongTimeMs) {
        if (externalPlaying) {
          const ms = getSongTimeMs();
          if (ms != null) {
            lyric.play(ms + latencyCompensationMs);
          }
        }
      } else {
        const audio = audioRef?.current;
        if (audio && !audio.paused) {
          const adjustedTimeMs =
            audio.currentTime * 1000 + offset * 1000 + latencyCompensationMs;
          lyric.play(adjustedTimeMs);
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== undefined) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [audioRef, getSongTimeMs, externalPlaying, offset, latencyCompensationMs]);

  const seekTo = (targetLyricTimeSeconds: number) => {
    const lyric = lyricRef.current;

    if (onSeekSongSeconds) {
      onSeekSongSeconds(targetLyricTimeSeconds);
      if (lyric) {
        lyric.play(targetLyricTimeSeconds * 1000 + latencyCompensationMs);
      }
      return;
    }

    const audio = audioRef?.current;
    if (!audio || !lyric) return;

    const targetAudioTime = targetLyricTimeSeconds - offset;
    const clampedTargetAudioTime = Math.max(0, Math.min(maxAudioSeconds, targetAudioTime));

    audio.currentTime = clampedTargetAudioTime;

    const adjustedTimeMs =
      clampedTargetAudioTime * 1000 + offset * 1000 + latencyCompensationMs;
    lyric.play(adjustedTimeMs);
  };

  return {
    currentLineIndex,
    lines,
    seekTo,
  };
}
