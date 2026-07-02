"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/Button";
import { BookOpen, Loader2, Music2, Play, Pause, RefreshCw, Sparkles, RotateCw } from "lucide-react";

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
    loadDailyWord(true);
    fetchQueueStatus();
  }, []);

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

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !data) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); return; }
    const startSec = data.audio.preview_offset + data.lyric.timestamp_ms / 1000;
    audio.currentTime = Math.max(0, startSec - 2);
    audio.play().catch((err) => {
      console.error("Playback failed:", err);
      setRefreshError("Audio preview unavailable in your region.");
      setIsPlaying(false);
    });
    setIsPlaying(true);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const stop = () => setIsPlaying(false);
    audio.addEventListener("ended", stop);
    audio.addEventListener("pause", stop);
    return () => { audio.removeEventListener("ended", stop); audio.removeEventListener("pause", stop); };
  }, [data]);

  const toggleFlip = () => {
    if (refreshing) return;
    setIsFlipped((prev) => !prev);
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

  const playerHref = "/player/" + data.song.id;
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
        <Button variant="ghost" size="sm" onClick={() => loadDailyWord(false)} disabled={refreshing} className="shrink-0 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest gap-2 whitespace-nowrap">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {readyCount > 0 ? "Next word" : "New word"}
        </Button>
      </div>

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

              <div className="space-y-4 min-w-0 flex-1 flex flex-col justify-center pointer-events-none">
                <div className="flex items-start gap-2 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-zinc-600 dark:text-zinc-500 min-w-0">
                  <Music2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 break-words">Found in {data.song.title} · {data.song.artist}</span>
                </div>
                <blockquote className="text-lg sm:text-xl md:text-2xl font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 italic break-words">
                  &ldquo;{highlightWord(data.lyric.snippet, data.lyric.char_start, data.lyric.char_end)}&rdquo;
                </blockquote>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">At {data.lyric.timestamp}</p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
                <Button onClick={togglePlay} disabled={refreshing} className="gap-2 uppercase tracking-widest text-[10px] font-bold">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  Hear it in the song
                </Button>
                <Link href={playerHref}>
                  <Button variant="secondary" disabled={refreshing} className="gap-2 uppercase tracking-widest text-[10px] font-bold">
                    <BookOpen className="w-4 h-4" />
                    Open full player
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {data.audio.preview_url && (
        <audio
          ref={audioRef}
          src={data.audio.preview_url}
          preload="none"
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
