import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #000000 100%)',
        }}
      >
        <div
          style={{
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            border: '8px solid #444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle, #222 0%, #000 80%)',
          }}
        >
          <div
            style={{
              width: '50%',
              height: '50%',
              borderRadius: '50%',
              background: '#0a0a0a',
              border: '4px solid #1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '30%',
                height: '30%',
                borderRadius: '50%',
                background: '#050505',
                border: '2px solid #00ffaa',
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: 180,
      height: 180,
    }
  );
}
