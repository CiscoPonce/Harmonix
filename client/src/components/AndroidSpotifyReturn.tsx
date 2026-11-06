'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const APP_PACKAGE = 'uk.co.peeporunclub.harmonix';

type Destination = 'library' | 'settings';

function outcomeFor(destination: Destination, raw: string | null) {
  if (destination === 'library') return raw === 'connected' ? 'connected' : null;
  return raw === 'error' || raw === 'cancelled' ? raw : null;
}

function ReturnToApp({ destination }: { destination: Destination }) {
  const searchParams = useSearchParams();
  const outcome = outcomeFor(destination, searchParams.get('spotify'));
  const reason = searchParams.get('reason');
  const safeReason = reason === 'denied' || reason === 'not_allowlisted' ? reason : null;
  const reasonQuery = outcome && outcome !== 'connected' && safeReason ? `&reason=${safeReason}` : '';
  const appUrl = outcome
    ? `intent://spotify-callback?spotify=${outcome}${reasonQuery}#Intent;scheme=harmonix;package=${APP_PACKAGE};end`
    : null;
  const webHref = destination === 'library' ? '/playlists' : '/settings';

  useEffect(() => {
    if (appUrl) window.location.href = appUrl;
  }, [appUrl]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-zinc-900 p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-xl font-bold">
          {outcome === 'connected' ? 'Spotify is connected' : 'Spotify did not connect'}
        </h1>
        <p className="text-sm text-zinc-600">Go back to the Harmonix app to keep learning.</p>
        {appUrl && (
          <a
            href={appUrl}
            className="block w-full rounded-full bg-[#0B4D2E] text-white font-semibold py-3"
          >
            Open Harmonix
          </a>
        )}
        <Link href={webHref} className="block text-sm underline text-zinc-600">
          Continue on the website
        </Link>
      </div>
    </main>
  );
}

export function AndroidSpotifyReturn({ destination }: { destination: Destination }) {
  return (
    <Suspense fallback={null}>
      <ReturnToApp destination={destination} />
    </Suspense>
  );
}
