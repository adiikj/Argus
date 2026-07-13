import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b0e14',
        backgroundImage:
          'linear-gradient(#1e2330 1px, transparent 1px), linear-gradient(90deg, #1e2330 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            border: '2px solid #2dd4bf',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '4px solid #2dd4bf',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#e6e8eb',
            textTransform: 'uppercase',
          }}
        >
          Argus
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 28,
          fontSize: 30,
          color: '#8b93a7',
        }}
      >
        AI-powered security event analysis
      </div>
    </div>,
    { ...size },
  );
}
