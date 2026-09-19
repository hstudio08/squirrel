import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon({ searchParams }: { searchParams: { size?: string } }) {
  const s = searchParams.size ? parseInt(searchParams.size, 10) : 512;
  
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
          borderRadius: '22%',
          border: '4px solid #333',
        }}
      >
        {/* Outer Lens */}
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
            boxShadow: 'inset 0 10px 20px rgba(0,0,0,0.5), 0 5px 15px rgba(0,0,0,0.5)',
          }}
        >
          {/* Inner Lens Glass */}
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
            {/* Lens Reflection */}
            <div
              style={{
                position: 'absolute',
                top: '15%',
                right: '25%',
                width: '30%',
                height: '30%',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                filter: 'blur(4px)',
              }}
            />
            {/* Aperture Ring */}
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
      width: s,
      height: s,
    }
  );
}
