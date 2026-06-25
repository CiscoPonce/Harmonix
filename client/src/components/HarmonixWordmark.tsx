import Link from 'next/link';

interface HarmonixWordmarkProps {
  href?: string | null;
  showTagline?: boolean;
  className?: string;
  linkClassName?: string;
}

export function HarmonixWordmark({
  href = '/',
  showTagline = false,
  className = '',
  linkClassName = '',
}: HarmonixWordmarkProps) {
  const mark = (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <span className="truncate text-lg font-black uppercase italic leading-none tracking-tighter text-zinc-900 dark:text-white sm:text-xl">
        Harmonix
      </span>
      {showTagline ? (
        <span className="mt-1 hidden text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-zinc-500 sm:block">
          Learn Words Through Music
        </span>
      ) : null}
    </div>
  );

  if (href == null || href === '') return mark;

  return (
    <Link
      href={href}
      className={`shrink-0 transition-opacity hover:opacity-90 ${linkClassName}`.trim()}
    >
      {mark}
    </Link>
  );
}
