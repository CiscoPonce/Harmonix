import type { ReactNode } from 'react';
import { LandingHeader } from '@/components/LandingHeader';
import { LandingFooter } from '@/components/LandingFooter';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="landing-container">
      <LandingHeader />
      <main className="landing-main mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold italic text-zinc-950 dark:text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Last updated {updated}</p>
        <div className="legal-prose mt-10 space-y-4 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
