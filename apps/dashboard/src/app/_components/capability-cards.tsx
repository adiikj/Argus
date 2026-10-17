import type { ReactNode } from 'react';

// "What it does": each capability with a small picture of it in action

const PROBES = [
  ['45.148.10.12', 'GET /.env', '404'],
  ['185.224.128.17', 'GET /wp-login.php', '404'],
  ['45.148.10.12', 'GET /.git/config', '404'],
];

function TrafficVisual() {
  return (
    <div className="space-y-1 font-mono text-[11.5px]">
      {PROBES.map(([ip, req, status], i) => (
        <div
          key={req}
          className={`flex items-center gap-3 rounded-[3px] px-2 py-1 ${
            i === 2 ? 'bg-bg-elevated text-text-primary' : 'text-text-muted'
          }`}
        >
          <span className="w-[108px] shrink-0 truncate">{ip}</span>
          <span className="min-w-0 flex-1 truncate">{req}</span>
          {i === 2 ? (
            <span className="rounded-[3px] border border-accent/40 px-1 text-[10.5px] text-accent">
              T1595.003
            </span>
          ) : (
            <span>{status}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryVisual() {
  return (
    <div>
      <div className="font-mono text-[10.5px] tracking-[0.08em] text-accent uppercase">
        AI summary
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-primary">
        Seven failed logins for deploy, then a success from the same address. Treat the account as
        compromised.
        <span className="animate-blink ml-0.5 inline-block h-[13px] w-[6px] translate-y-[2px] bg-accent" />
      </p>
    </div>
  );
}

function IntelVisual() {
  return (
    <div className="font-mono text-[11.5px]">
      <div className="flex items-center justify-between text-text-primary">
        <span>185.224.128.17</span>
        <span className="rounded-[3px] border border-border-strong px-1.5 text-[10.5px] text-text-secondary">
          NL
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-bg-elevated">
          <div className="h-full w-full rounded-full bg-severity-critical" />
        </div>
        <span className="text-severity-critical">100</span>
      </div>
      <div className="mt-1.5 text-[10.5px] text-text-muted">AbuseIPDB · 4,312 reports</div>
    </div>
  );
}

// deterministic tick heights, so server and client render the same thing
const TICKS = Array.from({ length: 30 }, (_, i) => 10 + ((i * 37) % 23));

function ThrottleVisual() {
  return (
    <div>
      <svg viewBox="0 0 240 44" className="h-11 w-full" aria-hidden>
        {TICKS.map((h, i) => (
          <rect
            key={i}
            x={i * 4.6}
            y={44 - h}
            width={2}
            height={h}
            rx={1}
            fill="var(--color-text-muted)"
            opacity={0.5 + (i % 3) * 0.15}
          />
        ))}
        <path d="M146 22h46" stroke="var(--color-border-strong)" strokeWidth={1.5} />
        <path
          d="m186 17 6 5-6 5"
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x={204} y={8} width={34} height={36} rx={3} fill="var(--color-accent)" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-text-muted">
        <span>2,400 alerts</span>
        <span className="text-accent">1 incident</span>
      </div>
    </div>
  );
}

const SCENARIOS = ['dir-enum', 'sqli', 'xss', 'password-spray', 'account-takeover', 'rate-abuse'];

function SimulatorVisual() {
  return (
    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
      {SCENARIOS.map((s) => (
        <span
          key={s}
          className={`flex items-center gap-1.5 rounded-[4px] border px-2 py-1 ${
            s === 'account-takeover'
              ? 'border-accent/50 text-accent'
              : 'border-border-subtle text-text-muted'
          }`}
        >
          {s === 'account-takeover' && (
            <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden>
              <path d="M2 1.5v7l6-3.5z" fill="currentColor" />
            </svg>
          )}
          {s}
        </span>
      ))}
    </div>
  );
}

const CARDS: { title: string; body: string; visual: ReactNode; span: string }[] = [
  {
    title: 'Real attack traffic',
    body: 'Scanners probing the live server become real incidents.',
    visual: <TrafficVisual />,
    span: 'lg:col-span-3',
  },
  {
    title: 'Written summaries',
    body: 'Each incident gets a short account of what happened and what to do next.',
    visual: <SummaryVisual />,
    span: 'lg:col-span-3',
  },
  {
    title: 'GeoIP and threat intel',
    body: 'Every public source is located and checked against AbuseIPDB.',
    visual: <IntelVisual />,
    span: 'lg:col-span-2',
  },
  {
    title: 'Alert throttling',
    body: 'A scanner sending thousands of requests stays one readable incident.',
    visual: <ThrottleVisual />,
    span: 'lg:col-span-2',
  },
  {
    title: 'Attack simulator',
    body: 'Ten scenarios you can fire at the live pipeline.',
    visual: <SimulatorVisual />,
    span: 'sm:col-span-2 lg:col-span-2',
  },
];

export function CapabilityCards() {
  return (
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {CARDS.map((card) => (
        <div
          key={card.title}
          className={`flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-border-subtle bg-bg-panel transition-colors hover:border-border-strong ${card.span}`}
        >
          <div className="flex min-h-[124px] items-center border-b border-border-subtle p-5">
            <div className="w-full">{card.visual}</div>
          </div>
          <div className="p-5">
            <h3 className="text-[15px] font-semibold">{card.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{card.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
