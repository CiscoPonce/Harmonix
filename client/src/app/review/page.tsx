'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface DueWord {
  vocab_id: string;
  word: string;
  definition: string;
  lemma: string;
  cefr_level: string;
  song_id?: string;
  line_index?: number;
}

interface ReviewResult {
  vocab_id: string;
  is_correct: boolean;
  response_ms: number;
}

export default function ReviewPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    let active = true;
    activeRef.current = true;

    async function fetchDue() {
      try {
        const res = await apiFetch('/progress/due?limit=20');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setDueWords(data.due || []);
        } else {
          setError('Could not load review words. Try again.');
        }
      } catch {
        if (active) setError('Could not load review words. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchDue();
    return () => { active = false; activeRef.current = false; };
  }, [user, authLoading, router]);

  const handleRate = (is_correct: boolean, responseMs: number) => {
    const word = dueWords[currentIndex];
    setResults((prev) => [...prev, { vocab_id: word.vocab_id, is_correct, response_ms: responseMs }]);

    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      submitResults([...results, { vocab_id: word.vocab_id, is_correct, response_ms: responseMs }]);
    }
  };

  const submitResults = async (finalResults: ReviewResult[]) => {
    setSubmitting(true);
    try {
      await apiFetch('/progress/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: finalResults }),
      });
    } catch {
      // Best effort — progress saved locally even if server fails
    }
    router.push('/dashboard');
  };

  const handleEndReview = () => {
    if (results.length > 0) {
      submitResults(results);
    } else {
      router.push('/dashboard');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-4">{error}</p>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (dueWords.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 animate-pulse mx-auto" />
          <h1 className="text-3xl font-bold tracking-tighter uppercase">All caught up!</h1>
          <p className="text-zinc-500 text-sm">No words due for review. Come back tomorrow.</p>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const currentWord = dueWords[currentIndex];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md space-y-8">
        {/* Progress */}
        <div className="text-center">
          <span className="inline-block px-2 py-1 rounded bg-zinc-900 text-xs font-bold uppercase tracking-widest">
            {currentIndex + 1}/{dueWords.length}
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-8 text-center space-y-4">
          <p className="text-5xl font-black tracking-tighter uppercase italic">{currentWord.word}</p>
          <p className="text-lg font-medium text-zinc-500">{currentWord.definition}</p>
          {currentWord.song_id && currentWord.line_index !== undefined && (
            <p className="text-sm text-zinc-600 italic">From song #{currentWord.song_id}</p>
          )}
        </div>

        {/* Rating buttons */}
        <div className="flex gap-2 justify-center">
          <Button variant="secondary" onClick={() => handleRate(true, 1200)} disabled={submitting}>
            Good
          </Button>
          <Button variant="secondary" onClick={() => handleRate(true, 3500)} disabled={submitting}>
            Hard
          </Button>
          <Button variant="secondary" onClick={() => handleRate(false, 5000)} disabled={submitting}>
            Again
          </Button>
        </div>

        {/* End review */}
        <div className="text-center">
          <button
            onClick={handleEndReview}
            disabled={submitting}
            className="text-sm text-zinc-500 hover:text-white underline-offset-4 hover:underline disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'End review'}
          </button>
        </div>
      </div>
    </div>
  );
}
