'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { buildReviewChoices } from '@/lib/reviewChoices';
import { useTranslation } from '@/lib/i18n';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface DueWord {
  vocab_id: string;
  word: string;
  definition: string;
  lemma: string;
  cefr_level: string;
  song_id?: string;
  line_index?: number;
  context_sentence?: string | null;
  song_title?: string | null;
  song_artist?: string | null;
}

interface ReviewResult {
  vocab_id: string;
  is_correct: boolean;
  response_ms: number;
}

export default function ReviewPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [pool, setPool] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [showScore, setShowScore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const activeRef = useRef(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    let active = true;
    activeRef.current = true;

    async function fetchDue() {
      try {
        const [dueRes, learnedRes] = await Promise.all([
          apiFetch('/progress/due?limit=10'),
          apiFetch('/vocab/learned'),
        ]);
        if (!active) return;
        if (!dueRes.ok) {
          setError('review_load_error');
          return;
        }
        const data = await dueRes.json();
        const due = (data.due || []) as DueWord[];
        setDueWords(due);
        const learnedDefs: string[] = [];
        if (learnedRes.ok) {
          const learned = await learnedRes.json();
          for (const word of learned.words || []) {
            if (word?.definition) learnedDefs.push(String(word.definition));
          }
        }
        const meanings = [
          ...due.map((word) => word.definition),
          ...learnedDefs,
        ];
        setPool(meanings);
        if (due[0]) {
          setChoices(buildReviewChoices(due[0].definition, meanings));
          shownAt.current = Date.now();
        }
      } catch {
        if (active) setError('review_load_error');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchDue();
    return () => { active = false; activeRef.current = false; };
  }, [user, authLoading, router]);

  const finishRound = (finalResults: ReviewResult[]) => {
    setResults(finalResults);
    setShowScore(true);
    if (finalResults.length === 0) return;
    setSubmitting(true);
    apiFetch('/progress/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: finalResults }),
    }).catch(() => {
      // The score still stands if the save fails. The next round can retry.
    }).finally(() => {
      if (activeRef.current) setSubmitting(false);
    });
  };

  const choose = (option: string) => {
    if (picked || showScore) return;
    const word = dueWords[currentIndex];
    if (!word) return;
    setPicked(option);
    const correct = option.trim().toLowerCase() === word.definition.trim().toLowerCase();
    const entry: ReviewResult = {
      vocab_id: word.vocab_id,
      is_correct: correct,
      response_ms: Date.now() - shownAt.current,
    };
    const next = [...results, entry];
    window.setTimeout(() => {
      if (!activeRef.current) return;
      if (currentIndex < dueWords.length - 1) {
        const upcoming = dueWords[currentIndex + 1];
        setResults(next);
        setCurrentIndex((index) => index + 1);
        setChoices(buildReviewChoices(upcoming.definition, pool));
        setPicked(null);
        shownAt.current = Date.now();
      } else {
        finishRound(next);
      }
    }, 900);
  };

  const handleEndReview = () => {
    if (results.length > 0) finishRound(results);
    else router.push('/discover');
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
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-4">{t(error)}</p>
          <Button variant="secondary" onClick={() => router.push('/discover')}>
            {t('review_back_word')}
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
          <h1 className="text-3xl font-bold tracking-tighter uppercase">{t('review_caught_up')}</h1>
          <p className="text-zinc-500 text-sm">{t('review_empty')}</p>
          <Button variant="secondary" onClick={() => router.push('/discover')}>
            {t('review_back_word')}
          </Button>
        </div>
      </div>
    );
  }

  if (showScore) {
    const known = results.filter((result) => result.is_correct).length;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
        <div className="w-full max-w-md text-center space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('review_score_title')}</p>
          <p className="text-6xl font-black tracking-tighter">{known}/{results.length}</p>
          <p className="text-zinc-400">{t('review_score_line', { correct: known, n: results.length })}</p>
          <Button variant="secondary" onClick={() => router.push('/discover')} disabled={submitting}>
            {submitting ? t('review_saving') : t('review_back_word')}
          </Button>
        </div>
      </div>
    );
  }

  const currentWord = dueWords[currentIndex];
  const answer = currentWord.definition.trim().toLowerCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <span className="inline-block px-2 py-1 rounded bg-zinc-900 text-xs font-bold uppercase tracking-widest">
            {currentIndex + 1}/{dueWords.length}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-8 text-center space-y-4">
          <p className="text-5xl font-black tracking-tighter uppercase italic">{currentWord.word}</p>
          <p className="text-sm font-medium text-zinc-400">{t('review_prompt')}</p>
          {currentWord.context_sentence && (
            <p className="text-sm text-zinc-500 italic">&ldquo;{currentWord.context_sentence}&rdquo;</p>
          )}
          {(currentWord.song_title || currentWord.song_artist) && (
            <p className="text-xs text-zinc-600">
              {[currentWord.song_title, currentWord.song_artist].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {choices.map((choice) => {
            const chosen = picked != null && picked === choice;
            const isAnswer = choice.trim().toLowerCase() === answer;
            const revealed = picked != null;
            const tone = !revealed
              ? 'border-zinc-800 bg-zinc-950 hover:border-zinc-500'
              : isAnswer
                ? 'border-green-500 bg-green-500/15'
                : chosen
                  ? 'border-red-500 bg-red-500/15'
                  : 'border-zinc-900 bg-zinc-950 opacity-60';
            return (
              <button
                key={choice}
                type="button"
                disabled={revealed}
                onClick={() => choose(choice)}
                className={`rounded-xl border px-4 py-3 text-left text-base font-medium transition-colors ${tone}`}
              >
                {choice}
              </button>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={handleEndReview}
            disabled={submitting || picked != null}
            className="text-sm text-zinc-500 hover:text-white underline-offset-4 hover:underline disabled:opacity-50"
          >
            {t('review_end')}
          </button>
        </div>
      </div>
    </div>
  );
}
