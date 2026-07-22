import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Harmonix word postcard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Card = {
  word?: { text?: string; translation?: string | null };
  song?: { title?: string; artist?: string };
};

async function loadCard(id: string): Promise<Card | null> {
  const base = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
  try {
    const res = await fetch(`${base}/api/share/postcards/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Card;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await loadCard(id);
  const word = String(card?.word?.text || 'Word').slice(0, 32);
  const meaning = String(card?.word?.translation || '').slice(0, 48);
  const song =
    card?.song?.title && card?.song?.artist
      ? `${card.song.title} — ${card.song.artist}`.slice(0, 56)
      : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(61,207,122,0.35), transparent 55%), linear-gradient(165deg, #0a1f16 0%, #06140e 48%, #030a07 100%)',
          color: '#f2f5f3',
          fontFamily: 'Georgia, Times New Roman, serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: '#3dcf7a',
            fontWeight: 700,
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Harmonix · Word postcard
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: word.length > 12 ? 72 : word.length > 8 ? 88 : 108,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            {word}
          </div>
          {meaning ? (
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                color: '#a7f3d0',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {meaning}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            paddingTop: 28,
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          {song ? (
            <div style={{ display: 'flex', fontSize: 28, color: '#e4e4e7' }}>{song}</div>
          ) : null}
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              color: '#71717a',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Learn vocabulary through real lyrics
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
