import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Harmonix word postcard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Card = {
  word?: { text?: string; translation?: string | null };
  song?: { id?: string | null; title?: string; artist?: string };
  cover?: string | null;
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

async function resolveCoverUrl(card: Card | null): Promise<string | null> {
  if (card?.cover) return card.cover;
  const songId = card?.song?.id;
  if (!songId) return null;
  try {
    const base = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${base}/api/tracks/${encodeURIComponent(String(songId))}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { cover?: string | null };
    return data.cover || null;
  } catch {
    return null;
  }
}

/** Satori often cannot fetch CDN images; embed as a data URL instead. */
async function coverAsDataUrl(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null;
  try {
    const res = await fetch(coverUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 2_500_000) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    const mime =
      ct.startsWith('image/')
        ? ct
        : buf[0] === 0xff && buf[1] === 0xd8
          ? 'image/jpeg'
          : buf[0] === 0x89 && buf[1] === 0x50
            ? 'image/png'
            : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
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
  const coverUrl = await resolveCoverUrl(card);
  const cover = await coverAsDataUrl(coverUrl);
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
          flexDirection: 'row',
          background:
            'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(61,207,122,0.28), transparent 55%), linear-gradient(165deg, #0a1f16 0%, #06140e 48%, #030a07 100%)',
          color: '#f2f5f3',
          fontFamily: 'Georgia, Times New Roman, serif',
        }}
      >
        <div
          style={{
            width: 420,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              width={320}
              height={320}
              alt=""
              style={{
                width: 320,
                height: 320,
                objectFit: 'cover',
                borderRadius: 24,
                boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              }}
            />
          ) : (
            <div
              style={{
                width: 320,
                height: 320,
                borderRadius: 24,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                color: '#3dcf7a',
                letterSpacing: 4,
                textTransform: 'uppercase',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Harmonix
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 64px 64px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#3dcf7a',
              fontWeight: 700,
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Harmonix · Word postcard
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                fontSize: word.length > 12 ? 64 : word.length > 8 ? 78 : 92,
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
                  fontSize: 34,
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
              gap: 8,
              borderTop: '1px solid rgba(255,255,255,0.15)',
              paddingTop: 24,
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {song ? (
              <div style={{ display: 'flex', fontSize: 26, color: '#e4e4e7' }}>{song}</div>
            ) : null}
            <div
              style={{
                display: 'flex',
                fontSize: 18,
                color: '#71717a',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Learn vocabulary through real lyrics
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
