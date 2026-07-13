import type { ReactNode } from 'react';
import Link from 'next/link';
import { LiveDemo } from './_components/live-demo';
import { Wordmark } from './_components/wordmark';

const PIPELINE = ['Generate', 'Stream', 'Normalize', 'Detect', 'Correlate', 'Summarize'];

const STEPS = [
  {
    n: '01',
    title: 'Events stream in',
    body: 'A scenario-driven generator emits realistic security logs — auth, network, process — onto Kafka. A /simulate API lets you fire attacks on demand.',
  },
  {
    n: '02',
    title: 'Everything is normalized',
    body: 'The parser validates each event against a Zod schema at the Kafka boundary and maps it into one canonical shape before anything downstream sees it.',
  },
  {
    n: '03',
    title: 'The engine detects',
    body: 'Stateful rules run over the normalized stream — brute-force bursts, privilege escalation, anomalies — and emit alerts the instant a threshold trips.',
  },
  {
    n: '04',
    title: 'Alerts become incidents',
    body: 'Correlation groups related alerts into a single incident, and an LLM drafts a plain-language summary so an analyst reads the story, not the noise.',
  },
];

const FEATURES = [
  {
    icon: 'M4 7h16M4 12h16M4 17h10',
    title: 'Event-driven ingestion',
    body: 'Millions of raw events stream in and are normalized into one canonical schema before anything downstream ever sees them.',
    tag: 'streaming',
  },
  {
    icon: 'M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z',
    title: 'Real-time threat detection',
    body: 'A stateful engine watches the stream and fires the instant a threshold trips — brute-force bursts, privilege escalation, anomalies.',
    tag: 'detection',
  },
  {
    icon: 'M8 7a3 3 0 016 0v10a3 3 0 01-6 0M16 7a3 3 0 00-6 0',
    title: 'Automatic correlation',
    body: 'Related alerts collapse into a single incident, so your team sees one coherent attack — not a thousand disconnected lines of noise.',
    tag: 'incidents',
  },
  {
    icon: 'M12 3v4M12 17v4M5 12H3M21 12h-2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18',
    title: 'AI incident summaries',
    body: 'Every incident is explained in plain language — attacker, target, technique, and the next action to take. No triage archaeology.',
    tag: 'ai',
  },
  {
    icon: 'M3 5h18v11H3zM8 20h8M12 16v4',
    title: 'Real-time console',
    body: 'Alerts appear the moment they fire over a live connection — no refreshing, no polling, no waiting for a batch job.',
    tag: 'live',
  },
  {
    icon: 'M9 6l-4 6 4 6M15 6l4 6-4 6',
    title: 'Reliable by design',
    body: 'Every event is validated at the boundary and carries a trace id end-to-end, so nothing silently drops and everything is auditable.',
    tag: 'trust',
  },
];

const STATS = [
  { value: '1M+', label: 'events processed / run' },
  { value: '<1s', label: 'event → alert on screen' },
  { value: '24/7', label: 'always-on monitoring' },
  { value: '100%', label: 'events traced end-to-end' },
];

function CtaButton({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/login"
      className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-mono text-sm font-semibold text-bg-base transition-transform hover:-translate-y-0.5"
    >
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-base/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark />
          <nav className="flex items-center gap-6 font-mono text-xs text-text-secondary">
            <a href="#how" className="hidden transition-colors hover:text-text-primary sm:inline">
              How it works
            </a>
            <a
              href="#features"
              className="hidden transition-colors hover:text-text-primary sm:inline"
            >
              Features
            </a>
            <Link href="/login" className="transition-colors hover:text-accent">
              live console →
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="relative overflow-hidden border-b border-border-subtle">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-text-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-secondary) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel px-3 py-1 font-mono text-xs text-text-secondary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              AI-powered security event analysis
            </span>

            <h1 className="mx-auto mt-8 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              The hundred-eyed watchman for your logs.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
              Argus ingests a live stream of security events, detects threats with a rule-based
              engine, correlates them into incidents, and explains each one in plain language — all
              on a real-time console.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4">
              <CtaButton>Launch the console</CtaButton>
              <a
                href="https://github.com"
                className="rounded-lg border border-border-subtle px-6 py-3 font-mono text-sm text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
              >
                View source
              </a>
            </div>
          </div>

          {/* live demo panel */}
          <div className="relative mx-auto max-w-5xl px-6 pt-6 pb-24">
            <LiveDemo />
            <p className="mt-5 text-center font-mono text-xs text-text-secondary">
              A live simulation — real alerts stream the same way inside the console.
            </p>
          </div>
        </section>

        {/* pipeline strip */}
        <section className="border-b border-border-subtle bg-bg-panel/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-4 px-6 py-8">
            {PIPELINE.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="font-mono text-sm text-text-secondary">
                  <span className="text-accent">{String(i + 1).padStart(2, '0')}</span> {step}
                </span>
                {i < PIPELINE.length - 1 && (
                  <span className="text-border-subtle" aria-hidden>
                    ──
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
            An event-driven pipeline, end to end — every stage is a real module that could stand
            alone as a service.
          </p>
          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-2">
            {STEPS.map((step) => (
              <div key={step.n} className="bg-bg-panel p-8">
                <span className="font-mono text-sm text-accent">{step.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI incident summary showcase */}
        <section className="border-y border-border-subtle bg-bg-panel/40">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                AI incident summaries
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                From a wall of alerts to a paragraph a human can act on.
              </h2>
              <p className="mt-4 text-text-secondary">
                Correlation stitches related alerts into one incident, then an LLM writes the
                summary — attacker, target, technique, and what to do next. No model key configured?
                Argus falls back to a deterministic template so it always runs.
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-bg-panel p-6 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                <span className="font-mono text-xs text-text-secondary">INC-2043</span>
                <span className="rounded border border-severity-critical/30 bg-severity-critical/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-severity-critical">
                  critical
                </span>
              </div>
              <ul className="mt-4 space-y-1.5 font-mono text-xs text-text-secondary">
                <li>· 61× failed SSH from 10.0.4.12</li>
                <li>· successful root login on prod-web-01</li>
                <li>· privilege escalation + outbound :4444</li>
              </ul>
              <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                  Generated summary
                </span>
                <p className="mt-2 text-sm leading-relaxed text-text-primary">
                  A brute-force campaign from <span className="text-accent">10.0.4.12</span>{' '}
                  succeeded against <span className="text-accent">prod-web-01</span> after 61 failed
                  attempts, gaining root and opening an outbound channel on port 4444. Likely C2.
                  Isolate the host and rotate credentials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-28">
          <div className="text-center">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              Capabilities
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything your SOC needs, watching in real time.
            </h2>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group/card relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel p-7 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/5"
              >
                {/* hover glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-accent/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover/card:opacity-100"
                />
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated text-accent transition-colors group-hover/card:border-accent/40">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d={feature.icon} />
                    </svg>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-text-primary">{feature.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* stats band */}
        <section className="border-y border-border-subtle bg-bg-panel/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden bg-border-subtle lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-bg-base px-6 py-12 text-center">
                <div className="font-mono text-4xl font-semibold text-accent">{stat.value}</div>
                <div className="mt-2 text-sm text-text-secondary">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* closing cta */}
        <section className="relative overflow-hidden border-t border-border-subtle">
          <div
            aria-hidden
            className="animate-glow pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-64 max-w-3xl rounded-full bg-accent/15 blur-3xl"
          />
          <div className="mx-auto max-w-6xl px-6 py-28 text-center">
            <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight">
              See it detect an attack, live.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-text-secondary">
              Watch alerts fire, correlate into incidents, and get explained — in real time.
            </p>
            <div className="mt-10">
              <CtaButton>Launch the console</CtaButton>
            </div>
          </div>
        </section>

        <footer className="border-t border-border-subtle">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 font-mono text-xs text-text-secondary sm:flex-row">
            <Wordmark />
            <span>The hundred-eyed watchman for your logs.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
