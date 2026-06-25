'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
];

const GENRES = ['Any', 'Pop', 'Rock', 'Hip-Hop', 'Reggaeton'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [genre, setGenre] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-xl font-medium animate-pulse uppercase tracking-widest italic font-black">Harmonix</p>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSkip = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ native_language: 'en', target_language: 'es' }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (nativeLanguage) body.native_language = nativeLanguage;
      if (targetLanguage) body.target_language = targetLanguage;
      if (genre) body.genre = genre.toLowerCase();
      if (difficulty) body.difficulty = difficulty.toLowerCase();
      const res = await apiFetch('/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm space-y-8">
        {/* Step indicator */}
        <div className="flex justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-white' : 'bg-zinc-700'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-white' : 'bg-zinc-700'}`} />
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tighter uppercase">Set your languages</h1>
              <p className="text-zinc-400 text-sm mt-2">Choose your native and target languages</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Native Language</label>
                <select
                  value={nativeLanguage}
                  onChange={(e) => setNativeLanguage(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-zinc-800 bg-black px-3 py-1 text-sm text-white focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-zinc-400"
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Language</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-zinc-800 bg-black px-3 py-1 text-sm text-white focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-zinc-400"
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tighter uppercase">Personalize your experience</h1>
              <p className="text-zinc-400 text-sm mt-2">Optional — you can change these anytime</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Favorite Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-zinc-800 bg-black px-3 py-1 text-sm text-white focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-zinc-400"
                >
                  <option value="">Any</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-zinc-800 bg-black px-3 py-1 text-sm text-white focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-zinc-400"
                >
                  <option value="">Medium</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              variant="primary"
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Start learning'}
            </Button>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-zinc-500 hover:text-white underline-offset-4 hover:underline disabled:opacity-50"
          >
            Skip &rarr; Use defaults
          </button>
        </div>
      </div>
    </div>
  );
}
