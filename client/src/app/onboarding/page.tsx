'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { LANGUAGES } from '@/lib/languages';
import Image from 'next/image';
import { CheckCircle2, Music2, Globe, Disc } from 'lucide-react';

const MUSIC_STYLES = [
  { id: 'pop', label: 'Pop', desc: 'Catchy hooks & clear vocals', icon: '🎤' },
  { id: 'rock', label: 'Rock', desc: 'High energy & rhythm', icon: '🎸' },
  { id: 'hip-hop', label: 'Hip-Hop', desc: 'Fast cadence & urban slang', icon: '🎧' },
  { id: 'reggaeton', label: 'Reggaeton', desc: 'Latin beats & dance rhythms', icon: '🔥' },
  { id: 'any', label: 'Any Genre', desc: 'Mix of all styles', icon: '🎵' },
];

const VOICE_GENDERS = [
  { id: 'female', label: 'Female Voice', desc: 'Natural female voice' },
  { id: 'male', label: 'Male Voice', desc: 'Natural male voice' },
];

export default function OnboardingPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [nativeLanguage, setNativeLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [genre, setGenre] = useState('pop');
  const [voiceGender, setVoiceGender] = useState('female');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.native_language) setNativeLanguage(user.native_language);
      if (user.target_language) setTargetLanguage(user.target_language);
      if (user.genre) setGenre(user.genre);
      if (user.voice_gender) setVoiceGender(user.voice_gender);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="animate-pulse text-xl font-black uppercase tracking-widest text-zinc-400">
          Harmonix
        </p>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSaveStep1And2 = async () => {
    if (!nativeLanguage || !targetLanguage) {
      setError('Please select both your mother language and target language');
      return;
    }
    if (nativeLanguage === targetLanguage) {
      setError('Mother language and target language must be different');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch('/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          native_language: nativeLanguage,
          target_language: targetLanguage,
          genre: genre.toLowerCase(),
          voice_gender: voiceGender,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save preferences');
      }
      await refreshUser();
      setSaving(false);
      setStep(3); // Proceed to Spotify connection
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  const handleConnectSpotify = async () => {
    try {
      const res = await apiFetch('/spotify/connect-url');
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch (err) {
      console.error('Spotify connect error:', err);
    }
    // Fallback: proceed to app
    router.push('/discover');
  };

  const handleFinish = async () => {
    await refreshUser();
    router.push('/discover');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-8">
        {/* Header Branding */}
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
            Welcome to Harmonix
          </p>
          <h1 className="mt-1 text-3xl font-extrabold uppercase tracking-tight">
            Setup Your Profile
          </h1>
        </div>

        {/* Wizard Steps Progress Indicator */}
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-emerald-500 text-black ring-4 ring-emerald-500/20'
                    : step > s
                    ? 'bg-zinc-800 text-emerald-400'
                    : 'bg-zinc-900 text-zinc-600'
                }`}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className="h-0.5 w-6 bg-zinc-800" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Mother Language & Target Language */}
        {step === 1 && (
          <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2 text-emerald-400">
                <Globe className="h-5 w-5" />
                <h2 className="text-lg font-bold">Languages</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Select your mother language and the language you want to learn.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Mother Language (Native)
                </label>
                <select
                  value={nativeLanguage}
                  onChange={(e) => setNativeLanguage(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Target Language (Learning)
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button
              variant="primary"
              className="w-full rounded-xl py-3 font-bold text-black bg-emerald-400 hover:bg-emerald-300"
              onClick={() => {
                if (nativeLanguage === targetLanguage) {
                  setError('Mother language and target language must be different');
                  return;
                }
                setError(null);
                setStep(2);
              }}
            >
              Continue &rarr;
            </Button>
          </div>
        )}

        {/* STEP 2: Style of Music & Voice */}
        {step === 2 && (
          <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2 text-emerald-400">
                <Music2 className="h-5 w-5" />
                <h2 className="text-lg font-bold">Music & Voice Preferences</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Choose your favorite genre to tailor song vocabulary recommendations.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Favorite Music Style
              </label>
              <div className="grid grid-cols-1 gap-2">
                {MUSIC_STYLES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGenre(m.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      genre === m.id
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{m.icon}</span>
                      <div>
                        <p className="text-sm font-bold">{m.label}</p>
                        <p className="text-xs text-zinc-400">{m.desc}</p>
                      </div>
                    </div>
                    {genre === m.id && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Pronunciation Voice
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VOICE_GENDERS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceGender(v.id)}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      voiceGender === v.id
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm font-bold">{v.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="w-1/3 rounded-xl border border-zinc-800 text-zinc-400"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                variant="primary"
                className="w-2/3 rounded-xl py-3 font-bold text-black bg-emerald-400 hover:bg-emerald-300"
                onClick={handleSaveStep1And2}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Next Step &rarr;'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Spotify Connection (Optional) */}
        {step === 3 && (
          <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="space-y-1 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <Disc className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold">Connect Spotify (Optional)</h2>
              <p className="text-xs text-zinc-400">
                Link your Spotify account to auto-sync your favorite songs and lyrics.
              </p>
            </div>

            {user?.is_spotify_connected ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="mt-2 text-sm font-bold text-emerald-400">Spotify Connected!</p>
                {user.spotify_display_name && (
                  <p className="text-xs text-zinc-400">Account: {user.spotify_display_name}</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <Image
                    src="/spotify-logo.svg"
                    alt="Spotify"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                    unoptimized
                  />
                  <span className="text-sm font-bold text-white">Spotify Integration</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Import your playlists & stream synchronized lyrics directly inside Harmonix.
                </p>
                <Button
                  variant="primary"
                  className="w-full rounded-xl bg-[#1DB954] py-3 font-bold text-black hover:bg-[#1ed760]"
                  onClick={handleConnectSpotify}
                >
                  Connect Spotify Account
                </Button>
              </div>
            )}

            <div className="space-y-3 text-center">
              <Button
                variant="primary"
                className="w-full rounded-xl py-3 font-bold text-black bg-emerald-400 hover:bg-emerald-300"
                onClick={handleFinish}
              >
                {user?.is_spotify_connected ? 'Finish Setup & Start Learning' : 'Skip & Start Learning'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
