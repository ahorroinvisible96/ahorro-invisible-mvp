import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const size = Math.min(512, Math.max(32, parseInt(request.nextUrl.searchParams.get('size') ?? '512')));
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.54);

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: `${radius}px`,
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize,
            fontWeight: 800,
            fontFamily: 'sans-serif',
            letterSpacing: '-0.03em',
          }}
        >
          AI
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
