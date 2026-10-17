import { ImageResponse } from 'next/og';
import { RULE_CATALOG } from '@argus/contracts/rules';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TEAL = '#2dd4bf';
const RULES = Object.values(RULE_CATALOG);
const TECHNIQUES = new Set(RULES.map((r) => r.technique.id)).size;

// social preview card for link unfurls
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: '#080b10',
        color: '#e4e8ee',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <path
              d="M14.4 5.4 A11.2 10.6 0 0 0 14.4 26.6"
              fill="none"
              stroke={TEAL}
              strokeWidth="3.2"
            />
            <path
              d="M17.6 5.4 A11.2 10.6 0 0 1 17.6 26.6"
              fill="none"
              stroke={TEAL}
              strokeWidth="3.2"
            />
            <circle cx="16" cy="16" r="3.9" fill={TEAL} />
          </svg>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 600 }}>Argus</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 68,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          <div style={{ display: 'flex' }}>See every attack.</div>
          <div style={{ display: 'flex', color: '#8d96a8' }}>Understand every incident.</div>
        </div>

        <div style={{ display: 'flex', gap: 28, fontSize: 24, color: '#8d96a8' }}>
          <div style={{ display: 'flex' }}>{RULES.length} detection rules</div>
          <div style={{ display: 'flex', color: '#2a3344' }}>·</div>
          <div style={{ display: 'flex' }}>{TECHNIQUES} MITRE ATT&amp;CK techniques</div>
          <div style={{ display: 'flex', color: '#2a3344' }}>·</div>
          <div style={{ display: 'flex', color: TEAL }}>argus.buzz</div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
