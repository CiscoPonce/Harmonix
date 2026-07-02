"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "./ui/Button";
import { BookOpen, Loader2, Music2, Play, Pause, RefreshCw, Sparkles } from "lucide-react";

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
  const [data, setData] = useState<DailyWordPayload | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
    if (payload.queue) setQueueStatus(payload.queue);
    setError(null);
    setRefreshError(null);
    setStatusMessage(null);
    onWordChange?.();
  }, [onWordChange]);

  const loadDailyWord = useCallback(async (initial = false) => {
    if (!initial) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    const hasBuffered = (queueStatus?.ready ?? 0) > 0;
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
          msg = "AI could not find a valid word. Please try again.";
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

  const showHeavyOverlay = refreshing && (queueStatus?.ready ?? 0) === 0;

  if (loading && !data) {
    return (
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-10 flex flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Loading your word...</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-600">First load may take up to a minute while we stock your queue</span>
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

      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-900 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-zinc-500 dark:text-zinc-400 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="shrink-0">Word of the day</span>
          {data.cached && !refreshing && <span className="text-zinc-400 dark:text-zinc-600">· cached</span>}
          {readyCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-[9px]">
              {readyCount} ready
            </span>
          )}
          {queueStatus?.refilling && readyCount === 0 && !refreshing && (
            <span className="text-zinc-400 dark:text-zinc-600">· stocking queue</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => loadDailyWord(false)} disabled={refreshing} className="self-start sm:self-auto text-[10px] font-bold uppercase tracking-wide sm:tracking-widest gap-2 shrink-0">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {readyCount > 0 ? "Next word" : "New word"}
        </Button>
      </div>

      <div className="p-5 sm:p-8 md:p-10 space-y-6 sm:space-y-8">
        <div className="space-y-3 min-w-0">
          <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight uppercase sm:italic text-zinc-900 dark:text-white break-words [overflow-wrap:anywhere]">{data.word.text}</p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-bold text-zinc-900 dark:text-white break-words">{data.word.translation}</span>
            {data.word.part_of_speech && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white">{data.word.part_of_speech}</span>
            )}
            {data.word.pronunciation && <span className="text-zinc-500">{data.word.pronunciation}</span>}
            {data.from_queue && (
              <span className="text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400">Instant</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex items-start gap-2 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest text-zinc-600 dark:text-zinc-500 min-w-0">
            <Music2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">Found in {data.song.title} · {data.song.artist}</span>
          </div>
          <blockquote className="text-lg sm:text-xl md:text-2xl font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 italic break-words">
            &ldquo;{highlightWord(data.lyric.snippet, data.lyric.char_start, data.lyric.char_end)}&rdquo;
          </blockquote>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">At {data.lyric.timestamp}</p>
        </div>

        <div className="flex flex-wrap gap-3">
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
