import Image from 'next/image';
import Link from 'next/link';

interface HarmonixWordmarkProps {
  href?: string | null;
  showTagline?: boolean;
  /** Visual size of the logo mark */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  linkClassName?: string;
}

const SIZE_CLASS = {
  sm: 'h-8 w-auto sm:h-9',
  md: 'h-10 w-auto sm:h-11',
  lg: 'h-14 w-auto sm:h-16',
} as const;

export function HarmonixWordmark({
  href = '/',
  showTagline = false,
  size = 'md',
  className = '',
  linkClassName = '',
}: HarmonixWordmarkProps) {
  const mark = (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <Image
        src="/logo.png"
        alt="Harmonix — Learn Words Through Music"
        width={1024}
        height={558}
        className={`${SIZE_CLASS[size]} max-w-full object-contain object-left`}
        priority
      />
      {showTagline ? (
        <span className="sr-only">Learn Words Through Music</span>
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
