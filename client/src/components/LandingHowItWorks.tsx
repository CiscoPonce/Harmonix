'use client';

import { Play, Sparkles, Trophy } from 'lucide-react';

export function LandingHowItWorks() {
  const steps = [
    {
      num: '01',
      icon: <Play className="h-6 w-6 text-emerald-400" />,
      title: 'Choose a Song & Language',
      desc: 'Pick your favorite tracks in Spanish, French, German, Italian, Portuguese, or English.',
    },
    {
      num: '02',
      icon: <Sparkles className="h-6 w-6 text-purple-400" />,
      title: 'Sing Along & Learn Words',
      desc: 'Tap synced karaoke lyrics to reveal instant definitions, native pronunciations, and AI explanations.',
    },
    {
      num: '03',
      icon: <Trophy className="h-6 w-6 text-amber-400" />,
      title: 'Master & Build Memory',
      desc: 'Review words with spaced repetition cards and unlock achievements as your vocabulary grows.',
    },
  ];

  return (
    <section id="how-it-works" className="w-full bg-zinc-950 py-24 text-white border-t border-zinc-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
            Simple 3-Step Process
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight uppercase">
            How Harmonix Works
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Learning a language should feel like listening to your favorite album. Here is how you master vocabulary in minutes.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div
              key={s.num}
              className="relative rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl backdrop-blur-sm hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700">
                  {s.icon}
                </div>
                <span className="text-3xl font-black text-zinc-700">{s.num}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
