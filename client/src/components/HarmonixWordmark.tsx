'use client';

import Image from 'next/image';
import Link from 'next/link';

interface HarmonixWordmarkProps {
  href?: string | null;
  showTagline?: boolean;
  /** Visual size of the logo mark */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Force a variant. `auto` (default) swaps light/dark assets with the theme
   * so the mark stays readable on light and dark surfaces.
   */
  variant?: 'auto' | 'light' | 'dark';
  /** Use the icon-only mark (no wordmark text). */
  markOnly?: boolean;
  className?: string;
  linkClassName?: string;
}

const SIZE_CLASS = {
  sm: 'h-8 w-auto sm:h-9',
  md: 'h-10 w-auto sm:h-11',
  lg: 'h-14 w-auto sm:h-16',
} as const;

const MARK_SIZE_CLASS = {
  sm: 'h-8 w-auto',
  md: 'h-10 w-auto',
  lg: 'h-14 w-auto',
} as const;

export function HarmonixWordmark({
  href = '/',
  showTagline = false,
  size = 'md',
  variant = 'auto',
  markOnly = false,
  className = '',
  linkClassName = '',
}: HarmonixWordmarkProps) {
  const sizeClass = markOnly ? MARK_SIZE_CLASS[size] : SIZE_CLASS[size];

  let mark: React.ReactNode;
  if (markOnly) {
    mark = (
      <div className={`flex min-w-0 flex-col ${className}`}>
        <Image
          src="/logo-mark.png"
          alt="Harmonix"
          width={390}
          height={280}
          className={`${sizeClass} max-w-full object-contain object-left`}
          priority
        />
        {showTagline ? <span className="sr-only">Learn Words Through Music</span> : null}
      </div>
    );
  } else if (variant === 'auto') {
    mark = (
      <div className={`flex min-w-0 flex-col ${className}`}>
        <Image
          src="/logo-light.png"
          alt="Harmonix — Learn Words Through Music"
          width={1024}
          height={558}
          className={`${sizeClass} max-w-full object-contain object-left dark:hidden`}
          priority
        />
        <Image
          src="/logo-dark.png"
          alt="Harmonix — Learn Words Through Music"
          width={1024}
          height={558}
          className={`${sizeClass} max-w-full object-contain object-left hidden dark:block`}
          priority
        />
        {showTagline ? <span className="sr-only">Learn Words Through Music</span> : null}
      </div>
    );
  } else {
    mark = (
      <div className={`flex min-w-0 flex-col ${className}`}>
        <Image
          src={variant === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
          alt="Harmonix — Learn Words Through Music"
          width={1024}
          height={558}
          className={`${sizeClass} max-w-full object-contain object-left`}
          priority
        />
        {showTagline ? <span className="sr-only">Learn Words Through Music</span> : null}
      </div>
    );
  }

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
