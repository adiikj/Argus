import { ImageResponse } from 'next/og';
import { RULE_CATALOG } from '@argus/contracts/rules';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CYAN = '#22d3ee';
const VIOLET = '#a78bfa';
const RULES = Object.values(RULE_CATALOG);
const TECHNIQUES = new Set(RULES.map((r) => r.technique.id)).size;

// the social-preview card (link unfurls on LinkedIn, Slack, X, …)
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        backgroundColor: '#05070b',
        backgroundImage: `radial-gradient(circle at 15% 0%, rgba(34,211,238,0.18), transparent 45%), radial-gradient(circle at 95% 100%, rgba(167,139,250,0.16), transparent 45%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 100% 100%, 44px 44px, 44px 44px',
        color: '#e9edf3',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width="64" height="64" viewBox="0 0 32 32">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={CYAN} />
              <stop offset="100%" stopColor={VIOLET} />
            </linearGradient>
          </defs>
          <path
            d="M14.4 5.4 A11.2 10.6 0 0 0 14.4 26.6"
            fill="none"
            stroke="url(#g)"
            strokeWidth="3.2"
          />
          <path
            d="M17.6 5.4 A11.2 10.6 0 0 1 17.6 26.6"
            fill="none"
            stroke="url(#g)"
            strokeWidth="3.2"
          />
          <circle cx="16" cy="16" r="3.9" fill="url(#g)" />
        </svg>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Argus
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
          }}
        >
          Every attack, seen.
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.1,
            backgroundImage: `linear-gradient(100deg, ${CYAN}, ${VIOLET})`,
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Every incident, explained.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 24, color: '#8b95a9' }}>
        {[
          `${RULES.length} detection rules`,
          `${TECHNIQUES} MITRE ATT&CK techniques`,
          'live at argus.buzz',
        ].map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid #263043',
              backgroundColor: 'rgba(11,15,22,0.8)',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
