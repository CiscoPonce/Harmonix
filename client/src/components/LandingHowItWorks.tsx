'use client';

import { Play, Sparkles, Trophy } from 'lucide-react';

export function LandingHowItWorks() {
  const steps = [
    {
      num: '01',
      icon: <Play className="h-6 w-6 text-emerald-400" />,
      title: 'Pick a language & style',
      desc: 'Spanish, French, German, Italian, Portuguese, or English — plus the music style you actually listen to.',
    },
    {
      num: '02',
      icon: <Sparkles className="h-6 w-6 text-purple-400" />,
      title: 'Get a Word of the Day',
      desc: 'Harmonix matches a real song and a real lyric line, then shows meaning, IPA, and a tap-to-hear pronunciation.',
    },
    {
      num: '03',
      icon: <Trophy className="h-6 w-6 text-amber-400" />,
      title: 'Hear it, save it, keep going',
      desc: 'Play a short clip around the word, add it to a playlist, and build a streak as your library grows.',
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
            Language learning that starts from a real lyric line. Here is how Word of the Day works.
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
