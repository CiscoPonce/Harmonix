import type { Metadata } from 'next';
import { headers } from 'next/headers';

type MetaPayload = {
  card: {
    id: string;
    word?: { text?: string; translation?: string | null };
    song?: { title?: string; artist?: string };
  };
  seo: {
    title: string;
    ogTitle: string;
    description: string;
  };
};

async function loadMeta(id: string): Promise<MetaPayload | null> {
  const base = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
  try {
    const res = await fetch(
      `${base}/api/share/postcards/${encodeURIComponent(id)}/meta`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return (await res.json()) as MetaPayload;
  } catch {
    return null;
  }
}

async function absoluteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3009';
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const origin = await absoluteOrigin();
  const meta = await loadMeta(id);
  const title = meta?.seo?.title || 'Harmonix word postcard';
  const description =
    meta?.seo?.description ||
    'Learn vocabulary through real song lyrics on Harmonix.';
  const ogTitle = meta?.seo?.ogTitle || 'Harmonix';
  const pageUrl = `${origin}/share/${encodeURIComponent(id)}`;
  // Prefer Express PNG (stable for crawlers) + Next opengraph-image as alt path.
  const imageUrl = `${origin}/api/share/postcards/${encodeURIComponent(id)}/og.png?v=3`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'website',
      url: pageUrl,
      siteName: 'Harmonix',
      title: ogTitle,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [imageUrl],
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
