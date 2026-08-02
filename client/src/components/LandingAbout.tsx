'use client';

import { Headphones, ShieldCheck, Zap } from 'lucide-react';

export function LandingAbout() {
  return (
    <section id="about" className="w-full bg-black py-24 text-white border-t border-zinc-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
              About Harmonix
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight uppercase">
              The Science of Musical Language Learning
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              Harmonix combines real-time synchronized song lyrics with advanced AI speech synthesis and spaced repetition memory algorithms. 
              Music triggers dopamine release, locking rhythm and vocabulary permanently into long-term memory.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Native Audio Synthesis</h4>
                  <p className="text-xs text-zinc-400">Natural voice synthesis for crystal clear pronunciation in 6 languages.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Spotify & Deezer Sync</h4>
                  <p className="text-xs text-zinc-400">Import your favorite playlists or explore curated genre collections.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Scientifically Proven Review</h4>
                  <p className="text-xs text-zinc-400">Spaced repetition review ensures you never forget a word you learned.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold uppercase tracking-wide">Frequently Asked Questions</h3>
            
            <div className="space-y-4 divide-y divide-zinc-800/60">
              <div className="pt-2 space-y-1">
                <p className="text-sm font-semibold text-white">Is Harmonix free to use?</p>
                <p className="text-xs text-zinc-400">Yes! You can start learning for free immediately without requiring a credit card.</p>
              </div>

              <div className="pt-4 space-y-1">
                <p className="text-sm font-semibold text-white">What languages are supported?</p>
                <p className="text-xs text-zinc-400">Spanish, French, German, Italian, Portuguese, and English.</p>
              </div>

              <div className="pt-4 space-y-1">
                <p className="text-sm font-semibold text-white">Do I need a Spotify Premium account?</p>
                <p className="text-xs text-zinc-400">No, Spotify connection is optional. Harmonix works with standard web previews and built-in tracks.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
