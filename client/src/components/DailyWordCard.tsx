"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, fetchSpotifyStatus, parseJsonResponse, resolveSpotifyPlay } from "@/lib/api";
import {
  computeDeezerHearWindow,
  computeSpotifyHearClip,
  formatPreviewWindowLabel,
} from "@/lib/hearItTiming";
import { useAuth } from "@/hooks/useAuth";
import { useSpotifyInAppPlayer } from "@/components/SpotifyInAppPlayer";
import { Button } from "./ui/Button";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { FolderPlus, Loader2, Music2, Play, Pause, RefreshCw, Share2, Sparkles, RotateCw, Volume2 } from "lucide-react";

const SUPPORTED_PRONUNCIATION_LANGUAGES = ["es", "fr", "de", "pt", "en", "it"];

interface QueueStatus {
  ready: number;
  refilling: boolean;
  target: number;
  max: number;
}

interface DailyWordPayload {
  date: string;
  cached?: boolean;
  from_queue?: boolean;
  word: {
    text: string;
    translation: string;
    part_of_speech?: string | null;
    pronunciation?: string | null;
    difficulty?: string;
  };
  lyric: {
    snippet: string;
    timestamp: string;
    timestamp_ms: number;
    line_end_ms?: number | null;
    line_index: number;
    char_start: number;
    char_end: number;
    in_preview?: boolean | null;
  };
  song: {
    id: string;
    title: string;
    artist: string;
    genre?: string | null;
  };
  audio: {
    preview_url: string;
    duration_seconds: number;
    preview_offset: number;
    preview_end?: number;
  };
  queue?: QueueStatus;
}

function highlightWord(snippet: string, start: number, end: number) {
  const before = snippet.slice(0, start);
  const word = snippet.slice(start, end);
  const after = snippet.slice(end);
  return (
    <>
      {before}
      <mark className="bg-zinc-900 dark:bg-white text-white dark:text-black px-1 rounded-sm not-italic">{word}</mark>
      {after}
    </>
  );
}

export function DailyWordCard({ onWordChange }: { onWordChange?: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<DailyWordPayload | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);
  const hearStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioProviderRef = useRef<'spotify' | 'deezer' | null>(null);
  const [hearBusy, setHearBusy] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharing, setSharing] = useState(false);
  const spotifyPlayer = useSpotifyInAppPlayer();
  const loadAbortRef = useRef<AbortController | null>(null);

  const clearHearStopTimer = useCallback(() => {
    if (hearStopTimerRef.current) {
      clearTimeout(hearStopTimerRef.current);
      hearStopTimerRef.current = null;
    }
  }, []);

  // Warm Spotify in background (non-blocking). Hear-it must never wait forever on this.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchSpotifyStatus();
        if (cancelled || status.state !== 'connected' || status.playback_scopes_ok === false) {
          return;
        }
        await Promise.race([
          spotifyPlayer.warmup(),
          new Promise((resolve) => window.setTimeout(resolve, 10000)),
        ]);
      } catch {
        /* ignore — Deezer remains available */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/daily-word/queue-status");
      if (res.ok) {
        setQueueStatus(await res.json());
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const applyPayload = useCallback((payload: DailyWordPayload) => {
    setData(payload);
    setIsFlipped(false);
    if (payload.queue) setQueueStatus(payload.queue);
    setError(null);
    setRefreshError(null);
    setStatusMessage(null);
    onWordChange?.();
  }, [onWordChange]);

  const loadDailyWord = useCallback(async (initial = false) => {
    const hasBuffered = (queueStatus?.ready ?? 0) > 0;

    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;

    if (!initial) {
      setRefreshing(true);
      setRefreshError(null);
      setElapsedSec(0);
    } else {
      setLoading(true);
      setError(null);
      setElapsedSec(0);
    }

    if (!initial && hasBuffered) {
      setStatusMessage("Loading next word…");
    } else if (!initial) {
      setStatusMessage("Asking AI for song candidates…");
    }

    try {
      const endpoint = initial ? "/daily-word" : "/daily-word/next";
      const res = await apiFetch(endpoint, {
        method: initial ? "GET" : "POST",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.queue) setQueueStatus(body.queue);
        let msg = body.reason || "Could not load daily word";
        if (body.reason === "invalid_ai_daily_word_response") {
          msg = "Couldn't find a new word in a song right now. Your song library may be exhausted — try again in a minute.";
        } else if (body.reason === "daily_word_generation_failed" || body.reason === "generation_failed") {
          msg = "Couldn't find a new word in a song right now. Please try again shortly.";
        } else if (body.reason === "ai_rate_limit" || body.reason?.includes("429")) {
          msg = "AI is busy (rate limit). Please wait a minute and try again.";
        } else if (body.reason === "cooldown_active") {
          msg = body.retryAfterSec
            ? `Please wait ${body.retryAfterSec} seconds before requesting another word.`
            : "Please wait a moment before requesting another word.";
        } else if (body.reason === "batch_in_progress") {
          msg = "Still generating your word — please wait a moment.";
        }
        throw new Error(msg);
      }
      applyPayload(await res.json());
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      const msg = err instanceof Error ? err.message : "Failed to load daily word";
      if (!initial && data) {
        setRefreshError(msg);
      } else {
        setError(msg);
      }
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
        setStatusMessage(null);
        setElapsedSec(0);
        fetchQueueStatus();
      }
    }
  }, [applyPayload, data, fetchQueueStatus, queueStatus?.ready]);

  useEffect(() => {
    if (!user?.target_language) return;
    setData(null);
    setError(null);
    setRefreshError(null);
    setIsFlipped(false);
    loadDailyWord(true);
    fetchQueueStatus();
    return () => loadAbortRef.current?.abort();
  }, [user?.target_language, user?.native_language]);

  // Poll while stocking OR while cold-generating so the "ready" badge updates live.
  useEffect(() => {
    const shouldPoll = queueStatus?.refilling || (refreshing && (queueStatus?.ready ?? 0) === 0);
    if (!shouldPoll) return;
    const timer = setInterval(fetchQueueStatus, 2000);
    return () => clearInterval(timer);
  }, [queueStatus?.refilling, queueStatus?.ready, refreshing, fetchQueueStatus]);

  useEffect(() => {
    if (!refreshing && !(loading && !data)) return;
    setElapsedSec(0);
    const tick = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    const timers = [
      setTimeout(() => setStatusMessage("Searching Deezer for a real track…"), 6000),
      setTimeout(() => setStatusMessage("Checking synced lyrics on LRCLib…"), 16000),
      setTimeout(() => setStatusMessage("Still matching — cold generate can take up to a minute…"), 32000),
    ];
    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, [refreshing, loading, data]);

  const playDeezerClip = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !data) return false;
    clearHearStopTimer();

    const win = computeDeezerHearWindow({
      timestamp_ms: data.lyric.timestamp_ms,
      line_end_ms: data.lyric.line_end_ms,
      snippet: data.lyric.snippet,
      char_start: data.lyric.char_start,
      char_end: data.lyric.char_end,
      preview_offset: data.audio.preview_offset || 0,
    });

    if (!win.inWindow) {
      setRefreshError(
        `Word is at ${data.lyric.timestamp}; Deezer preview is ${formatPreviewWindowLabel(data.audio.preview_offset || 0)}. Playing the closest available clip.`
      );
      window.setTimeout(() => setRefreshError(null), 5500);
    }

    try {
      if (audio.readyState < 1) {
        audio.load();
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error('audio_load_failed'));
          };
          const cleanup = () => {
            audio.removeEventListener('loadedmetadata', onReady);
            audio.removeEventListener('error', onErr);
          };
          audio.addEventListener('loadedmetadata', onReady, { once: true });
          audio.addEventListener('error', onErr, { once: true });
        });
      }

      audio.currentTime = win.seekTo;
      if (Math.abs(audio.currentTime - win.seekTo) > 0.35) {
        await new Promise<void>((resolve) => {
          const done = () => {
            audio.removeEventListener('seeked', done);
            resolve();
          };
          audio.addEventListener('seeked', done, { once: true });
          window.setTimeout(done, 450);
        });
      }

      await audio.play();
      audioProviderRef.current = 'deezer';
      setIsPlaying(true);
      if (win.inWindow) setRefreshError(null);

      const playMs = Math.max(1500, (win.stopAt - win.seekTo) * 1000);
      hearStopTimerRef.current = setTimeout(() => {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        setIsPlaying(false);
        hearStopTimerRef.current = null;
      }, playMs);
      return true;
    } catch (err) {
      console.error('Playback failed:', err);
      return false;
    }
  }, [clearHearStopTimer, data]);

  const togglePlay = async () => {
    if (!data || hearBusy) return;
    setHearBusy(true);
    clearHearStopTimer();
    spotifyPlayer.unlockAudio();

    if (isPlaying) {
      if (audioProviderRef.current === 'spotify') {
        await spotifyPlayer.pausePlayback();
      } else {
        try {
          audioRef.current?.pause();
        } catch {
          /* ignore */
        }
      }
      setIsPlaying(false);
      setHearBusy(false);
      return;
    }

    setRefreshError(null);

    const trySpotifyHear = async (): Promise<boolean> => {
      const status = await fetchSpotifyStatus();
      if (status.state !== 'connected' || status.playback_scopes_ok === false) {
        return false;
      }
      spotifyPlayer.unlockAudio();
      const resolved = await resolveSpotifyPlay({
        title: data.song.title,
        artist: data.song.artist,
        song_id: data.song.id,
        duration_ms:
          data.audio.duration_seconds > 0
            ? Math.round(data.audio.duration_seconds * 1000)
            : null,
      });
      const clip = computeSpotifyHearClip({
        timestamp_ms: data.lyric.timestamp_ms,
        line_end_ms: data.lyric.line_end_ms,
        snippet: data.lyric.snippet,
        char_start: data.lyric.char_start,
        char_end: data.lyric.char_end,
      });
      return spotifyPlayer.playTrack(resolved.uri, {
        positionMs: clip.positionMs,
        stopAfterMs: clip.stopAfterMs,
      });
    };

    // Prefer Spotify for exact word timing when it starts quickly; else Deezer.
    try {
      const ok = await Promise.race([
        trySpotifyHear(),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 2800)),
      ]);
      if (ok) {
        audioProviderRef.current = 'spotify';
        setIsPlaying(true);
        setHearBusy(false);
        return;
      }
    } catch (err) {
      console.error('Spotify hear-it failed:', err);
    }

    // Deezer 30s preview — seek toward the highlighted word in the lyric line.
    if (!data.audio.preview_url) {
      setRefreshError(
        'No preview available. Reconnect Spotify in Settings for full-track audio.'
      );
      setIsPlaying(false);
      setHearBusy(false);
      return;
    }

    const deezerOk = await playDeezerClip();
    if (!deezerOk) {
      setRefreshError('Audio preview unavailable. Reconnect Spotify in Settings.');
      setIsPlaying(false);
    }
    setHearBusy(false);
  };

  useEffect(() => {
    return () => clearHearStopTimer();
  }, [clearHearStopTimer]);

  useEffect(() => {
    if (audioProviderRef.current !== 'spotify') return;
    if (spotifyPlayer.ui === 'playing') setIsPlaying(true);
    if (spotifyPlayer.ui === 'paused' || spotifyPlayer.ui === 'ready') setIsPlaying(false);
  }, [spotifyPlayer.ui]);

  useEffect(() => {
    clearHearStopTimer();
    void spotifyPlayer.pausePlayback();
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
    }
    audioProviderRef.current = null;
    setIsPlaying(false);
    // Only reset when the daily word identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.word?.text, data?.song?.id, clearHearStopTimer]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      clearHearStopTimer();
      setIsPlaying(false);
    };
    const onPlay = () => {
      if (audioProviderRef.current !== 'spotify') setIsPlaying(true);
    };
    const onPause = () => {
      if (audioProviderRef.current !== 'spotify') setIsPlaying(false);
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [data, clearHearStopTimer]);

  // Reset pronunciation playback when the daily word changes.
  useEffect(() => {
    if (pronunciationAudioRef.current) {
      try {
        pronunciationAudioRef.current.pause();
        pronunciationAudioRef.current.src = "";
      } catch {
        /* ignore */
      }
      pronunciationAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, [data?.word?.text]);

  const toggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const playPronunciation = async () => {
    // Stop any in-progress pronunciation so the user can replay freely.
    if (pronunciationAudioRef.current) {
      try {
        pronunciationAudioRef.current.pause();
        pronunciationAudioRef.current.src = "";
      } catch {
        /* ignore */
      }
      pronunciationAudioRef.current = null;
    }

    setIsSpeaking(true);
    let objectUrl: string | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSpeaking(false);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      pronunciationAudioRef.current = null;
    };

    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const res = await apiFetch(`/daily-word/pronounce?word=${encodeURIComponent(data!.word.text)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Pronunciation unavailable");
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        pronunciationAudioRef.current = audio;

        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        // Safety: never leave the button stuck disabled if ended doesn't fire.
        safetyTimer = setTimeout(finish, Math.max(8000, (blob.size / 48) + 2000));

        await audio.play();
        return;
      } catch {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        if (attempt === 1) {
          setIsSpeaking(false);
          setRefreshError("Pronunciation unavailable");
          setTimeout(() => setRefreshError(null), 3000);
        }
      }
    }
    setIsSpeaking(false);
  };

  const formatPronunciation = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("/") || trimmed.startsWith("[") || trimmed.includes("ˈ")) return trimmed;
    return `/${trimmed}/`;
  };

  if (loading && !data) {
    return (
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="px-4 py-3 sm:px-6 border-b border-zinc-100 dark:border-zinc-900 flex flex-row items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>Word of the day</span>
          </div>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
        </div>
        <div className="p-5 sm:p-8 md:p-10">
          <div className="min-h-[15.5rem] sm:min-h-[19rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4 sm:p-8 flex flex-col justify-between animate-pulse">
            <div className="flex justify-center pt-2">
              <div className="h-12 sm:h-16 w-2/3 max-w-xs rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ((error && !data) || !data) {
    return (
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 space-y-4 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{error || "No word available right now."}</p>
        <Button onClick={() => loadDailyWord(false)} disabled={refreshing}>
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Try again"}
        </Button>
      </div>
    );
  }

  const handleShare = async () => {
    const songId = String(data.song?.id || "").trim();
    if (!songId || typeof window === "undefined" || sharing) return;

    setSharing(true);
    try {
      const res = await apiFetch("/share/postcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: data.word,
          lyric: data.lyric,
          song: data.song,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not create postcard");
      }
      const card = await parseJsonResponse<{
        id: string;
        path: string;
        spotify_url: string | null;
      }>(res);

      const shareUrl = `${window.location.origin}${card.path}`;
      const lines = [
        `Word postcard: ${data.word.text}`,
        data.word.translation ? `Meaning: ${data.word.translation}` : null,
        `Song: ${data.song.title} — ${data.song.artist}`,
        card.spotify_url ? `Open in Spotify: ${card.spotify_url}` : null,
        `Snapshot: ${shareUrl}`,
      ].filter(Boolean) as string[];
      const shareText = lines.join("\n");

      const copyShareUrl = async () => {
        await navigator.clipboard.writeText(shareText);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      };

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: `${data.word.text} · Harmonix word postcard`,
            text: shareText,
            url: shareUrl,
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      await copyShareUrl();
    } catch (err) {
      console.error("Share postcard failed:", err);
      setRefreshError(
        err instanceof Error ? err.message : "Could not create share postcard."
      );
    } finally {
      setSharing(false);
    }
  };

  const readyCount = queueStatus?.ready ?? data.queue?.ready ?? 0;
  // Full-screen blocker only on first cold load (no word yet). While refreshing,
  // keep the current word interactive and show a slim progress strip instead.
  const showHeavyOverlay = loading && !data;
  const showInlineProgress = refreshing && !!data;
  const homeLanguage = (user?.native_language || "en").toUpperCase();
  const meaning = data.word.translation?.trim();
  const showMeaning = Boolean(
    meaning && meaning.toLowerCase() !== data.word.text.toLowerCase()
  );

  return (
    <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {showHeavyOverlay && (
        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
            {statusMessage || "Generating your first word…"}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            {elapsedSec > 0 ? `${elapsedSec}s · ` : ""}
            Cold generate validates real songs — usually 20–60s
          </p>
        </div>
      )}

      {showInlineProgress && (
        <div className="px-4 py-2.5 sm:px-6 border-b border-amber-200/80 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 flex items-center gap-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700 dark:text-amber-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100 truncate">
              {statusMessage || (readyCount > 0 ? "Loading next word…" : "Finding a new word in a real song…")}
            </p>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-200/70">
              {readyCount > 0
                ? "Queue hit — should be instant"
                : `${elapsedSec}s · keep using this word; next one arrives when matched`}
            </p>
          </div>
          <div className="hidden sm:block h-1 w-24 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden shrink-0">
            <div
              className="h-full bg-amber-600 dark:bg-amber-400 transition-[width] duration-1000 ease-out"
              style={{ width: `${Math.min(92, 8 + elapsedSec * 1.4)}%` }}
            />
          </div>
        </div>
      )}

      {refreshError && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium text-center">
          {refreshError}
        </div>
      )}

      <div className="px-4 py-3 sm:px-6 border-b border-zinc-100 dark:border-zinc-900 flex flex-row items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2 min-w-0 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-zinc-500 dark:text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="shrink-0">Word of the day</span>
          {readyCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-[9px] shrink-0">
              {readyCount} ready
            </span>
          )}
          {(queueStatus?.refilling || (refreshing && readyCount === 0)) && !showHeavyOverlay && (
            <span className="text-zinc-400 dark:text-zinc-600 truncate">
              · {queueStatus?.refilling ? "stocking" : "matching"}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => loadDailyWord(false)}
            disabled={refreshing}
            className="gap-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide sm:tracking-widest"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {readyCount > 0 ? "Next word" : "New word"}
          </Button>
        </div>
      </div>
      <p className="border-b border-zinc-100 px-4 py-2 text-[11px] text-zinc-500 dark:border-zinc-900 dark:text-zinc-400 sm:px-6">
        {readyCount > 0
          ? `${readyCount} buffered — Next word is instant.`
          : "Request a new word anytime. First cold generate can take up to a minute; later ones are queued."}
      </p>

      <div className="p-5 sm:p-8 md:p-10">
        <div className="daily-word-flip-scene">
          <div
            className={`daily-word-flip-inner ${isFlipped ? "is-flipped" : ""}`}
            aria-live="polite"
          >
            {/* Front — word & translation */}
            <button
              type="button"
              className="daily-word-flip-face daily-word-flip-front flex flex-col justify-between text-left w-full min-h-[15.5rem] sm:min-h-[19rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4 sm:p-8 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600"
              onClick={toggleFlip}
              aria-label="Show song context for this word"
            >
              <div className="flex justify-center pt-1 sm:pt-2 min-w-0">
                <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight uppercase sm:italic text-zinc-900 dark:text-white break-words [overflow-wrap:anywhere] text-center">
                  {data.word.text}
                </p>
              </div>

              <div className="mt-auto space-y-4 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {data.word.pronunciation && (
                    <span className="text-base sm:text-lg font-medium text-zinc-500 dark:text-zinc-400 tracking-wide font-serif italic break-words">
                      {formatPronunciation(data.word.pronunciation)}
                    </span>
                  )}
                  {SUPPORTED_PRONUNCIATION_LANGUAGES.includes(user?.target_language || "") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void playPronunciation(); }}
                      className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Listen to pronunciation"
                      type="button"
                    >
                      <Volume2 className={`w-4 h-4 transition-colors ${isSpeaking ? "animate-pulse text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"}`} />
                    </button>
                  )}
                  {data.word.part_of_speech && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white shrink-0">
                      {data.word.part_of_speech}
                    </span>
                  )}
                  {showMeaning && (
                    <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white break-words">
                      {meaning}
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        {homeLanguage}
                      </span>
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  <RotateCw className="w-3 h-3 shrink-0" />
                  Tap for song context
                </p>
              </div>
            </button>

            {/* Back — lyric snippet & actions */}
            <div
              className="daily-word-flip-face daily-word-flip-back flex flex-col justify-between min-h-[15.5rem] sm:min-h-[19rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black p-4 sm:p-6 space-y-4 min-w-0 cursor-pointer"
              onClick={toggleFlip}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFlip(); } }}
              role="button"
              tabIndex={0}
              aria-label="Back to word"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 self-start">
                <RotateCw className="w-3 h-3 shrink-0" />
                Tap to flip back
              </p>

              <div className="space-y-4 min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-start gap-2 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-zinc-600 dark:text-zinc-500 min-w-0">
                  <Music2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 break-words">Found in {data.song.title} · {data.song.artist}</span>
                </div>
                <blockquote className="text-lg sm:text-xl md:text-2xl font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 italic break-words">
                  &ldquo;{highlightWord(data.lyric.snippet, data.lyric.char_start, data.lyric.char_end)}&rdquo;
                </blockquote>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">
                  Word around {data.lyric.timestamp}
                  {data.lyric.in_preview === false
                    ? ` · preview ${formatPreviewWindowLabel(data.audio.preview_offset || 0)}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Outside the 3D flip — links/buttons inside rotateY often fail hit-testing */}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void togglePlay()}
            disabled={hearBusy || (!data.audio.preview_url && !data.song.title)}
            className="gap-2 uppercase tracking-widest text-[10px] font-bold"
          >
            {hearBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {hearBusy ? 'Starting…' : 'Hear it in the song'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleShare()}
            disabled={!data.song.id || sharing}
            className="gap-2 uppercase tracking-widest text-[10px] font-bold"
          >
            {sharing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {sharing ? "Creating…" : copiedLink ? "Postcard copied!" : "Share"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAddPlaylist(true)}
            disabled={!data.song.id}
            className="gap-2 uppercase tracking-widest text-[10px] font-bold"
          >
            <FolderPlus className="w-4 h-4" />
            Add to my playlist
          </Button>
        </div>
      </div>

      {data.audio.preview_url && (
        <audio
          ref={audioRef}
          src={data.audio.preview_url}
          preload="metadata"
          onError={(e) => {
            console.error("Audio preview load failed:", e);
            setRefreshError("Audio preview unavailable in your region.");
            setIsPlaying(false);
          }}
        />
      )}

      <AddToPlaylistModal
        isOpen={showAddPlaylist}
        onClose={() => setShowAddPlaylist(false)}
        track={{
          id: data.song.id,
          title: data.song.title,
          artist: data.song.artist,
          preview: data.audio.preview_url,
          duration: data.audio.duration_seconds,
        }}
      />
    </div>
  );
}
