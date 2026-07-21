"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, fetchSpotifyStatus, resolveSpotifyPlay } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSpotifyInAppPlayer } from "@/components/SpotifyInAppPlayer";
import { Button } from "./ui/Button";
import { BookOpen, Loader2, Music2, Play, Pause, RefreshCw, Sparkles, RotateCw, Volume2 } from "lucide-react";

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

function formatPreviewWindow(offsetSec: number) {
  const start = Math.floor(offsetSec);
  const end = start + 30;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}

export function DailyWordCard({ onWordChange }: { onWordChange?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
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
  const spotifyPlayer = useSpotifyInAppPlayer();

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

    if (!initial) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    if (!initial && hasBuffered) {
      setStatusMessage(null);
    } else if (!initial) {
      setStatusMessage("Finding a new word in a real song...");
    }

    try {
      const endpoint = initial ? "/daily-word" : "/daily-word/next";
      const res = await apiFetch(endpoint, { method: initial ? "GET" : "POST" });
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
      const msg = err instanceof Error ? err.message : "Failed to load daily word";
      if (!initial && data) {
        setRefreshError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setStatusMessage(null);
      fetchQueueStatus();
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
  }, [user?.target_language, user?.native_language]);

  useEffect(() => {
    if (!queueStatus?.refilling) return;
    const timer = setInterval(fetchQueueStatus, 3000);
    return () => clearInterval(timer);
  }, [queueStatus?.refilling, fetchQueueStatus]);

  useEffect(() => {
    if (!refreshing) return;
    const timers = [
      setTimeout(() => setStatusMessage("Searching Deezer and LRCLib for a matching song..."), 8000),
      setTimeout(() => setStatusMessage("Still working — this can take up to a minute..."), 25000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [refreshing]);

  const playDeezerClip = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !data) return false;
    clearHearStopTimer();

    // Deezer preview is a 30s cut: for songs >60s it is full-song [30s, 60s].
    // audio.currentTime=0 is already at preview_offset in the full track.
    const PREVIEW_LEN = 30;
    const LEAD_IN = 1.25;
    const PLAY_AFTER = 5.5;
    const offset = data.audio.preview_offset || 0;
    const songTimeSec = data.lyric.timestamp_ms / 1000;
    const relative = songTimeSec - offset;
    const inWindow = relative >= 0.25 && relative <= PREVIEW_LEN - 1;

    let seekTo: number;
    let stopAt: number;
    if (inWindow) {
      seekTo = Math.max(0, Math.min(PREVIEW_LEN - 2, relative - LEAD_IN));
      stopAt = Math.min(PREVIEW_LEN, Math.max(seekTo + 3.5, relative + PLAY_AFTER));
    } else {
      seekTo = 0;
      stopAt = Math.min(PREVIEW_LEN, 8);
      setRefreshError(
        `Deezer preview is ~${formatPreviewWindow(offset)}; this line is at ${data.lyric.timestamp}. Playing the available clip.`
      );
      window.setTimeout(() => setRefreshError(null), 5000);
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

      audio.currentTime = seekTo;
      if (Math.abs(audio.currentTime - seekTo) > 0.35) {
        await new Promise<void>((resolve) => {
          const done = () => {
            audio.removeEventListener('seeked', done);
            resolve();
          };
          audio.addEventListener('seeked', done, { once: true });
          window.setTimeout(done, 400);
        });
      }

      await audio.play();
      audioProviderRef.current = 'deezer';
      setIsPlaying(true);
      if (inWindow) setRefreshError(null);

      const playMs = Math.max(1500, (stopAt - seekTo) * 1000);
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

    // Only try Spotify if the Web Playback SDK is already ready — never block Hear-it on SDK init.
    const spotifyAlreadyReady =
      spotifyPlayer.ui === 'ready' ||
      spotifyPlayer.ui === 'paused' ||
      spotifyPlayer.ui === 'playing';

    if (spotifyAlreadyReady) {
      try {
        const status = await fetchSpotifyStatus();
        if (status.state === 'connected' && status.playback_scopes_ok !== false) {
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
          const LEAD_IN_MS = 1250;
          const PLAY_AFTER_MS = 5500;
          const ok = await Promise.race([
            spotifyPlayer.playTrack(resolved.uri, {
              positionMs: Math.max(0, data.lyric.timestamp_ms - LEAD_IN_MS),
              stopAfterMs: LEAD_IN_MS + PLAY_AFTER_MS,
            }),
            new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 4000)),
          ]);
          if (ok) {
            audioProviderRef.current = 'spotify';
            setIsPlaying(true);
            setHearBusy(false);
            return;
          }
        }
      } catch (err) {
        console.error('Spotify hear-it failed:', err);
      }
    }

    // Default / fallback: Deezer 30s preview — must work without Spotify SDK.
    if (!data.audio.preview_url) {
      setRefreshError(
        'No preview available. Open full player, or wait for Spotify player to connect.'
      );
      setIsPlaying(false);
      setHearBusy(false);
      return;
    }

    const deezerOk = await playDeezerClip();
    if (!deezerOk) {
      setRefreshError('Audio preview unavailable. Try Open full player.');
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
    if (refreshing) return;
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
          <div className="min-h-[17rem] sm:min-h-[19rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-5 sm:p-8 flex flex-col justify-between animate-pulse">
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

  const playerHref = "/player/" + encodeURIComponent(String(data.song.id));
  const openFullPlayer = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    router.push(playerHref);
  };
  const readyCount = queueStatus?.ready ?? data.queue?.ready ?? 0;
  const showHeavyOverlay = refreshing && (queueStatus?.ready ?? 0) === 0;
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
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-white">{statusMessage || "Generating your next words..."}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            {queueStatus?.refilling ? "Stocking your word queue in the background…" : "Generating a batch of words — this can take up to a minute"}
          </p>
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
          {queueStatus?.refilling && readyCount === 0 && !refreshing && (
            <span className="text-zinc-400 dark:text-zinc-600 truncate">· stocking</span>
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
        Request a new word as many times as you like — no daily limit.
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
              className="daily-word-flip-face daily-word-flip-front flex flex-col justify-between text-left w-full min-h-[17rem] sm:min-h-[19rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-5 sm:p-8 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600"
              onClick={toggleFlip}
              disabled={refreshing}
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
              className="daily-word-flip-face daily-word-flip-back flex flex-col justify-between min-h-[17rem] sm:min-h-[19rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black p-4 sm:p-6 space-y-4 min-w-0 cursor-pointer"
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">At {data.lyric.timestamp}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Outside the 3D flip — links/buttons inside rotateY often fail hit-testing */}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void togglePlay()}
            disabled={refreshing || hearBusy || (!data.audio.preview_url && !data.song.title)}
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
            onClick={openFullPlayer}
            disabled={refreshing || !data.song.id}
            className="gap-2 uppercase tracking-widest text-[10px] font-bold"
          >
            <BookOpen className="w-4 h-4" />
            Open full player
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
    </div>
  );
}
