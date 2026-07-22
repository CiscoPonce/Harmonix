'use client';

import { Music2 } from 'lucide-react';

interface CoverArtProps {
  /** Primary cover URL */
  src?: string | null;
  /** Up to 4 covers for a playlist mosaic */
  covers?: Array<string | null | undefined>;
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
} as const;

export function CoverArt({
  src,
  covers,
  alt = '',
  className = '',
  size = 'md',
}: CoverArtProps) {
  const urls = (covers && covers.length > 0 ? covers : src ? [src] : [])
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
    .slice(0, 4);

  const box = `${SIZE[size]} shrink-0 overflow-hidden rounded-md border border-[#D7E0DA] bg-[#F4F7F5] dark:border-[#2A3530] dark:bg-[#0C1210] ${className}`;

  if (urls.length === 0) {
    return (
      <div className={`flex items-center justify-center ${box}`} aria-hidden>
        <Music2 className="h-6 w-6 text-[#5C6B62]" />
      </div>
    );
  }

  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Deezer CDN hosts vary
      <img
        src={urls[0]}
        alt={alt}
        className={`${box} object-cover`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={`grid grid-cols-2 grid-rows-2 ${box}`} aria-label={alt || undefined}>
      {Array.from({ length: 4 }).map((_, i) => {
        const url = urls[i] || urls[0];
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        );
      })}
    </div>
  );
}
