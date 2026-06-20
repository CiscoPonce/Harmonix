"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "./ui/Button";
import { BookOpen, Loader2, Music2, Play, Pause, RefreshCw, Sparkles } from "lucide-react";

interface DailyWordPayload {
  date: string;
  cached?: boolean;
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
}

function highlightWord(snippet: string, start: number, end: number) {
  const before = snippet.slice(0, start);
  const word = snippet.slice(start, end);
  const after = snippet.slice(end);
  return (
    <>
      {before}
      <mark className="bg-white text-black px-1 rounded-sm not-italic">{word}</mark>
      {after}
    </>
  );
}

export function DailyWordCard() {
  const [data, setData] = useState<DailyWordPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const loadDailyWord = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
      setRefreshError(null);
      setStatusMessage("Finding a new word in a real song...");
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await apiFetch(force ? "/daily-word/new" : "/daily-word", {
        method: force ? "POST" : "GET",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let msg = body.reason || "Could not load daily word";
        if (body.reason === "invalid_ai_daily_word_response") {
          msg = "AI could not find a valid word. Please try again.";
        } else if (body.reason === "ai_rate_limit" || body.reason?.includes("429")) {
          msg = "AI is busy (rate limit). Please wait a minute and try again.";
        } else if (body.reason === "cooldown_active") {
          msg = body.retryAfterSec
            ? `Please wait ${body.retryAfterSec} seconds before requesting another word.`
            : "Please wait a moment before requesting another word.";
        }
        throw new Error(msg);
      }
      const payload = await res.json();
      setData(payload);
      setError(null);
      setRefreshError(null);
      setStatusMessage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load daily word";
      if (force && data) {
        setRefreshError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setStatusMessage(null);
    }
  }, [data]);

  useEffect(() => { loadDailyWord(false); }, []);

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

  if (loading && !data) {
    return (
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-10 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest">Loading your word...</span>
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">First load may take up to a minute</span>
      </div>
    );
  }

  if ((error && !data) || !data) {
    return (
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-8 space-y-4 text-center">
        <p className="text-sm text-zinc-400">{error || "No word available right now."}</p>
        <Button onClick={() => loadDailyWord(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Try again"}
        </Button>
      </div>
    );
  }

  const playerHref = "/player/" + data.song.id;

  return (
    <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {refreshing && (
        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-sm font-bold uppercase tracking-widest text-white">{statusMessage || "Finding a new word..."}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Please wait — AI is picking a word and validating the song</p>
        </div>
      )}

      {refreshError && (
        <div className="px-6 py-3 bg-red-950/50 border-b border-red-900 text-red-300 text-xs font-medium text-center">
          {refreshError}
        </div>
      )}

      <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          Word of the day
          {data.cached && !refreshing && <span className="text-zinc-600">· cached</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => loadDailyWord(true)} disabled={refreshing} className="text-[10px] font-bold uppercase tracking-widest gap-2">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          New word
        </Button>
      </div>

      <div className="p-8 md:p-10 space-y-8">
        <div className="space-y-3">
          <p className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic">{data.word.text}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span className="font-bold text-white">{data.word.translation}</span>
            {data.word.part_of_speech && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] uppercase tracking-widest">{data.word.part_of_speech}</span>
            )}
            {data.word.pronunciation && <span className="text-zinc-500">{data.word.pronunciation}</span>}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black p-6 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <Music2 className="w-3.5 h-3.5" />
            Found in {data.song.title} · {data.song.artist}
          </div>
          <blockquote className="text-xl md:text-2xl font-medium leading-relaxed text-zinc-200 italic">
            &ldquo;{highlightWord(data.lyric.snippet, data.lyric.char_start, data.lyric.char_end)}&rdquo;
          </blockquote>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">At {data.lyric.timestamp}</p>
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
