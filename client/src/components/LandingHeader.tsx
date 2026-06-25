import Link from 'next/link';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';
import { ThemeToggle } from '@/components/ThemeToggle';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-900 dark:bg-black/90">
      <div
        className="mx-auto flex h-14 w-full max-w-7xl flex-row flex-nowrap items-center justify-between gap-3 px-4 sm:px-6"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <HarmonixWordmark href="/" showTagline linkClassName="min-w-0 shrink" />

        <nav className="hidden flex-row flex-nowrap items-center gap-8 lg:flex">
          <a href="#features" className="text-sm font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            How It Works
          </a>
          <a href="#testimonials" className="text-sm font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            Testimonials
          </a>
          <a href="#about" className="text-sm font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            About
          </a>
        </nav>

        <div className="flex shrink-0 flex-row flex-nowrap items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full border border-zinc-900 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-900 transition-all hover:bg-zinc-900 hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black sm:px-5 sm:text-xs"
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
