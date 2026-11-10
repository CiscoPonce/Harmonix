"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { pronouncePath } from "@/lib/pronounceRequest";
import { Loader2, Pause, Play, RefreshCw, Volume2 } from "lucide-react";

interface DailyWordPayload {
  word: {
    text: string;
    translation: string;
    part_of_speech?: string | null;
  };
  lyric: {
    snippet: string;
    timestamp: string;
    timestamp_ms: number;
    char_start: number;
    char_end: number;
  };
  song: {
    title: string;
    artist: string;
  };
  audio: {
    preview_url: string;
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
      <mark className="bg-white text-black px-0.5 rounded not-italic">{word}</mark>
      {after}
    </>
  );
}

export function WatchDailyWord() {
  const [data, setData] = useState<DailyWordPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const wordUrlRef = useRef<string | null>(null);
  const { user } = useAuth();

  const loadWord = useCallback(async (initial: boolean) => {
    if (initial) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    try {
      const endpoint = initial ? "/daily-word" : "/daily-word/next";
      const res = await apiFetch(endpoint, { method: initial ? "GET" : "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.reason || "Could not load word");
      }
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWord(true);
  }, [loadWord]);

  const stopWord = () => {
    const clip = wordAudioRef.current;
    if (clip) {
      clip.pause();
      clip.src = "";
    }
    if (wordUrlRef.current) {
      URL.revokeObjectURL(wordUrlRef.current);
      wordUrlRef.current = null;
    }
    setSpeaking(false);
  };

  const speakWord = async () => {
    if (!data) return;
    if (speaking) {
      stopWord();
      return;
    }
    const song = audioRef.current;
    if (song) song.pause();
    setIsPlaying(false);
    setSpeaking(true);
    const lang = user?.target_language || "es";
    try {
      const res = await apiFetch(pronouncePath(data.word.text, lang, user?.voice_gender), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Pronunciation unavailable");
      const blob = await res.blob();
      if (wordUrlRef.current) URL.revokeObjectURL(wordUrlRef.current);
      const url = URL.createObjectURL(blob);
      wordUrlRef.current = url;
      const clip = wordAudioRef.current ?? new Audio();
      wordAudioRef.current = clip;
      clip.src = url;
      clip.onended = () => setSpeaking(false);
      await clip.play();
    } catch {
      setSpeaking(false);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(data.word.text);
        utter.lang = lang;
        utter.onend = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utter);
      }
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !data) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    const PREVIEW_LEN = 30;
    const offset = data.audio.preview_offset || 0;
    const relative = data.lyric.timestamp_ms / 1000 - offset;
    const inWindow = relative >= 0.25 && relative <= PREVIEW_LEN - 1;
    const seekTo = inWindow
      ? Math.max(0, Math.min(PREVIEW_LEN - 2, relative - 1.25))
      : 0;
    const stopAt = inWindow
      ? Math.min(PREVIEW_LEN, Math.max(seekTo + 3.5, relative + 5.5))
      : 8;
    stopWord();
    try {
      if (audio.readyState < 1) audio.load();
      audio.currentTime = seekTo;
      await audio.play();
      setIsPlaying(true);
      window.setTimeout(() => {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        setIsPlaying(false);
      }, Math.max(1500, (stopAt - seekTo) * 1000));
    } catch {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      wordAudioRef.current?.pause();
      if (wordUrlRef.current) URL.revokeObjectURL(wordUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="watch-screen flex flex-col items-center justify-center gap-3 min-h-[180px] text-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Loading word...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="watch-screen flex flex-col items-center gap-4 min-h-[180px] text-center">
        <p className="text-xs text-zinc-400 leading-snug">{error}</p>
        <button
          type="button"
          onClick={() => loadWord(false)}
          disabled={refreshing}
          className="min-h-[44px] min-w-[44px] px-4 rounded-full bg-white text-black text-xs font-bold uppercase"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="watch-screen space-y-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Word of the day</p>

      <div className="space-y-1">
        <p className="text-[32px] font-black uppercase leading-none break-words [overflow-wrap:anywhere]">
          {data.word.text}
        </p>
        <p className="text-sm font-semibold text-zinc-300 break-words">{data.word.translation}</p>
        {data.word.part_of_speech && (
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{data.word.part_of_speech}</p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-2 text-left">
        <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500 line-clamp-1">
          {data.song.title} · {data.song.artist}
        </p>
        <p className="text-xs leading-snug text-zinc-300 italic line-clamp-3 break-words">
          &ldquo;{highlightWord(data.lyric.snippet, data.lyric.char_start, data.lyric.char_end)}&rdquo;
        </p>
        <p className="text-[9px] text-zinc-600 uppercase">{data.lyric.timestamp}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={speakWord}
          disabled={refreshing}
          className="flex items-center justify-center gap-1.5 min-h-[48px] rounded-full bg-white text-black text-[11px] font-bold uppercase"
        >
          <Volume2 className="w-4 h-4" />
          {speaking ? "Stop" : "Word"}
        </button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={refreshing || !data.audio.preview_url}
          className="flex items-center justify-center gap-1.5 min-h-[48px] rounded-full border border-zinc-600 text-[11px] font-bold uppercase text-white disabled:opacity-40"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? "Stop" : "Song"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => loadWord(false)}
        disabled={refreshing}
        className="flex items-center justify-center gap-2 min-h-[40px] w-full rounded-full text-[10px] font-bold uppercase text-zinc-400"
      >
        {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Next word
      </button>

      {data.audio.preview_url && (
        <audio ref={audioRef} src={data.audio.preview_url} preload="none" />
      )}
    </div>
  );
}
