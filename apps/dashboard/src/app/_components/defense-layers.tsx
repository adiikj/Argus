'use client';

import { useState, type ReactNode } from 'react';

// security as nested layers, outermost first: hovering a row lights up its
// ring in the diagram, and the other way round
const LAYERS = [
  ['Supply chain', 'CodeQL, gitleaks and Trivy on every push.'],
  ['Transport', 'TLS, strict CSP and HSTS.'],
  ['Abuse', 'Rate limits on the real client IP.'],
  ['Access', 'Admin, analyst and read-only roles. No public sign-up.'],
  ['Runtime', 'Scanned images, non-root containers.'],
] as const;

const VB = { w: 320, h: 250 };
const DX = 16;
const DY = 21;

export function DefenseLayers({ heading }: { heading: ReactNode }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="grid gap-12 lg:grid-cols-3">
      <div>
        {heading}
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="mt-8 w-full max-w-[360px]"
          onMouseLeave={() => setActive(null)}
          aria-hidden
        >
          {LAYERS.map(([name], i) => {
            const on = active === i;
            return (
              <g key={name} onMouseEnter={() => setActive(i)} className="cursor-default">
                <rect
                  x={i * DX + 0.5}
                  y={i * DY + 0.5}
                  width={VB.w - i * DX * 2 - 1}
                  height={VB.h - i * DY * 2 - 1}
                  rx={6}
                  fill="var(--color-accent)"
                  fillOpacity={on ? 0.09 : 0.012 * (i + 1)}
                  stroke={on ? 'var(--color-accent)' : 'var(--color-border-strong)'}
                  className="transition-[stroke,fill-opacity] duration-200"
                />
                <text
                  x={i * DX + 10}
                  y={i * DY + 14}
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={on ? 'var(--color-accent)' : 'var(--color-text-muted)'}
                  className="transition-[fill] duration-200"
                >
                  {name.toLowerCase()}
                </text>
              </g>
            );
          })}
          {/* the service at the core */}
          <g transform={`translate(${VB.w / 2 - 12} ${VB.h / 2 - 8}) scale(0.75)`}>
            <g fill="none" stroke="var(--color-accent)" strokeWidth={3.2}>
              <path d="M14.4 5.4 A11.2 10.6 0 0 0 14.4 26.6" />
              <path d="M17.6 5.4 A11.2 10.6 0 0 1 17.6 26.6" />
            </g>
            <circle cx={16} cy={16} r={3.9} fill="var(--color-accent)" />
          </g>
          <text
            x={VB.w / 2}
            y={VB.h / 2 + 30}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--font-mono)"
            fill="var(--color-text-secondary)"
          >
            argus
          </text>
        </svg>
      </div>

      <dl
        className="divide-y divide-border-subtle self-start border-y border-border-subtle lg:col-span-2"
        onMouseLeave={() => setActive(null)}
      >
        {LAYERS.map(([key, value], i) => (
          <div
            key={key}
            onMouseEnter={() => setActive(i)}
            className="grid gap-1 py-4 transition-colors sm:grid-cols-[150px_1fr] sm:gap-6"
          >
            <dt
              className={`flex items-center gap-2 text-[14px] font-medium transition-colors ${
                active === i ? 'text-accent' : 'text-text-primary'
              }`}
            >
              <span className="font-mono text-[11px] text-text-muted">0{i + 1}</span>
              {key}
            </dt>
            <dd className="text-[14.5px] leading-relaxed text-text-secondary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
