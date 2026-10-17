import { WORLD_DOTS, WORLD_VIEWBOX } from '@/lib/world-dots';

// the console's attack map, drawn statically for the landing page: a few
// sources arcing in toward the same target point the live map uses
const { width: W, height: H, latTop, latBottom } = WORLD_VIEWBOX;

function project(lat: number, lng: number) {
  return { x: ((lng + 180) / 360) * W, y: ((latTop - lat) / (latTop - latBottom)) * H };
}

const TARGET = project(39, -95);

const SOURCES = [
  { lat: 52.4, lng: 4.9, color: 'var(--color-severity-high)' },
  { lat: 55.8, lng: 37.6, color: 'var(--color-severity-critical)' },
  { lat: 31.2, lng: 121.5, color: 'var(--color-severity-high)' },
  { lat: 1.3, lng: 103.8, color: 'var(--color-severity-medium)' },
  { lat: -23.5, lng: -46.6, color: 'var(--color-severity-medium)' },
  { lat: 6.5, lng: 3.4, color: 'var(--color-severity-low)' },
].map((s) => ({ ...s, ...project(s.lat, s.lng) }));

function arc(from: { x: number; y: number }) {
  const mx = (from.x + TARGET.x) / 2;
  const my =
    (from.y + TARGET.y) / 2 - Math.min(120, Math.hypot(TARGET.x - from.x, TARGET.y - from.y) * 0.3);
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${TARGET.x} ${TARGET.y}`;
}

const LEGEND = [
  ['critical', 'var(--color-severity-critical)'],
  ['high', 'var(--color-severity-high)'],
  ['medium', 'var(--color-severity-medium)'],
  ['low', 'var(--color-severity-low)'],
];

export function HeroMap() {
  return (
    <figure aria-hidden className="w-full">
      <div className="relative py-6 sm:py-12">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible">
          <path
            d={WORLD_DOTS}
            stroke="var(--color-text-secondary)"
            strokeOpacity={0.3}
            strokeWidth={3.4}
            strokeLinecap="round"
            fill="none"
          />

          {SOURCES.map((s, i) => (
            <path
              key={`arc-${i}`}
              d={arc(s)}
              pathLength={1}
              fill="none"
              stroke={s.color}
              strokeWidth={1.6}
              strokeLinecap="round"
              className="animate-arc"
              style={{ animationDelay: `${i * 1.1}s` }}
            />
          ))}

          {SOURCES.map((s, i) => (
            <g key={`pin-${i}`}>
              <circle
                cx={s.x}
                cy={s.y}
                r={5}
                fill={s.color}
                className="animate-ping-soft"
                style={{ animationDelay: `${i * 1.1}s` }}
              />
              <circle cx={s.x} cy={s.y} r={4.5} fill={s.color} />
            </g>
          ))}

          <circle
            cx={TARGET.x}
            cy={TARGET.y}
            r={14}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity={0.35}
          />
          <circle cx={TARGET.x} cy={TARGET.y} r={6} fill="var(--color-accent)" />
          <text
            x={TARGET.x}
            y={TARGET.y + 38}
            textAnchor="middle"
            fill="var(--color-accent)"
            fontSize={17}
            fontFamily="var(--font-mono)"
          >
            argus
          </text>
        </svg>

        {/* pieces of the console, floating over the map */}
        <div className="animate-float absolute top-0 right-0 hidden items-center gap-2 rounded-[5px] border border-border-strong bg-bg-panel px-2.5 py-1.5 text-[12px] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-severity-high" />
          <span className="font-medium text-text-primary">SQL injection attempt</span>
          <span className="rounded-[3px] border border-accent/40 px-1 font-mono text-[10.5px] text-accent">
            T1190
          </span>
        </div>

        <div
          className="animate-float absolute right-[4%] bottom-0 hidden w-[200px] rounded-[5px] border border-border-strong bg-bg-panel p-3 font-mono text-[11px] sm:block"
          style={{ animationDelay: '-2s' }}
        >
          <div className="flex justify-between text-text-primary">
            <span>45.148.10.12</span>
            <span className="text-text-muted">NL</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-bg-elevated">
            <div className="h-full w-full rounded-full bg-severity-critical" />
          </div>
          <div className="mt-1.5 text-text-muted">AbuseIPDB 100/100</div>
        </div>

        <div
          className="animate-float absolute bottom-[6%] left-0 hidden w-[190px] rounded-[5px] border border-border-strong bg-bg-panel p-3 sm:block"
          style={{ animationDelay: '-4s' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-text-primary">Incident opened</span>
            <span className="rounded-[3px] border border-severity-critical/50 px-1 font-mono text-[10px] text-severity-critical">
              CRITICAL
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10.5px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            summary written
          </div>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
        {LEGEND.map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
