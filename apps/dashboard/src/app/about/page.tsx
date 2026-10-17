import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RULE_CATALOG } from '@argus/contracts/rules';
import { Github } from '@/components/icons/github';
import { Wordmark } from '../_components/wordmark';
import { Reveal } from '../_components/reveal';

const REPO_URL = 'https://github.com/adiikj/Argus';
const RULE_COUNT = Object.keys(RULE_CATALOG).length;

const HOW_ITS_BUILT = [
  {
    title: 'Two sources of traffic',
    body: 'A scenario-driven generator emits synthetic auth (sshd), nginx and API-gateway logs — plus, on the live deployment, nginx’s probe log: every request for a path the api doesn’t serve, i.e. real internet scanners.',
  },
  {
    title: 'Validated at the boundary',
    body: 'Three wire formats (syslog-ish text, nginx combined, JSON) parse into one Zod-validated NormalizedEvent. Every event carries an eventId set at the source that doubles as its trace id end to end.',
  },
  {
    title: 'Stateless + stateful detection',
    body: `${RULE_COUNT} rules on one interface: signatures (SQLi, traversal, XSS, command injection — with repeated, lenient URL-decoding), sliding windows (brute force, spraying, account takeover) and per-source baselines (anomaly).`,
  },
  {
    title: 'One catalog, mapped to ATT&CK',
    body: 'Every rule maps to a MITRE ATT&CK technique and tactic in a shared catalog that drives the console’s badges, kill chain and coverage page, the AI prompts and the README — tests fail if any drift.',
  },
  {
    title: 'Throttled, correlated incidents',
    body: 'Repeat alerts are suppressed per rule and source (the next one says how many it stood in for), then folded into one incident per source inside a correlation window, transactionally in Postgres.',
  },
  {
    title: 'Enriched before it’s explained',
    body: 'Source IPs get GeoIP (DB-IP) and AbuseIPDB reputation — cached, quota-capped, never sent out for demo or internal addresses — before an LLM (Gemini/Groq, or a deterministic template) writes the summary.',
  },
  {
    title: 'Live, traceable console',
    body: 'Every alert, incident and summary streams over WebSockets. The trace view follows one event by eventId across Kafka, the event store and Postgres — a real query, not a diagram.',
  },
  {
    title: 'Shipped through a gated pipeline',
    body: 'CI typechecks, tests, applies migrations to real Postgres with a drift check, scans dependencies, secrets and images, and builds the images the VM pulls — the server never builds anything.',
  },
];

const DECISIONS = [
  {
    title: 'Rules can’t share state by accident',
    body: 'The engine hands every rule its own key namespace in the window and baseline stores. Two rules once both keyed by source IP and read each other’s entries — 40 API calls + 1 failed SSH login looked like 41 failed logins.',
  },
  {
    title: 'Trust proxies by address, not hop count',
    body: 'Rate limits key on the real client IP. TRUST_PROXY lists the proxy’s addresses; hop counts and "true" are rejected at boot because both let a client forge X-Forwarded-For.',
  },
  {
    title: 'Never ingest the visitors',
    body: 'Only requests for paths the api doesn’t serve reach the probe log. Dashboard users only ever call real routes, so their IPs never become "attackers" in Argus.',
  },
  {
    title: 'Every integration degrades',
    body: 'No LLM key → template summaries. No AbuseIPDB key → no reputation. No GeoIP file → simulated demo pins only. No Redis → in-process state. The whole system runs with zero API keys.',
  },
  {
    title: 'Mechanically enforced boundaries',
    body: 'eslint-plugin-boundaries fails the build on a deep cross-module import: each module in apps/api/src is reachable only through its public index.ts or the internal event bus.',
  },
  {
    title: 'Scanners pinned by checksum',
    body: 'CI runs gitleaks and Trivy as official release binaries verified against a hardcoded SHA-256, not third-party actions on a mutable tag that could be re-pointed.',
  },
];

const STACK = [
  'TypeScript (strict)',
  'Node 24',
  'Fastify',
  'Kafka (KRaft)',
  'PostgreSQL + Prisma',
  'Redis',
  'Elasticsearch (optional)',
  'Next.js 16',
  'WebSockets',
  'Zod',
  'Docker',
  'GitHub Actions',
  'pnpm + Turborepo',
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
      <span className="bg-brand h-px w-6" />
      {children}
    </span>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="glass sticky top-0 z-30 border-b border-border-subtle/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Wordmark />
          <nav className="flex items-center gap-2 text-[13px]">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-text-secondary transition-colors hover:text-text-primary"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border-strong bg-bg-panel px-3.5 py-1.5 font-medium transition-colors hover:border-accent/50 hover:text-accent"
            >
              Open console
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border-subtle">
          <div
            aria-hidden
            className="bg-grid mask-radial pointer-events-none absolute inset-0 opacity-60"
          />
          <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
            <Reveal>
              <Eyebrow>About the project</Eyebrow>
              <h1 className="mx-auto mt-6 max-w-3xl text-balance text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
                A security analysis platform built to{' '}
                <span className="text-gradient">show the engineering, not just claim it.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-text-secondary">
                Argus is a portfolio project: a Kafka log pipeline, a detection engine mapped to
                MITRE ATT&amp;CK, incident correlation with enrichment and LLM summaries, and a
                real-time console — deployed on a small VM, running against real internet traffic.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-24">
          <Reveal>
            <Eyebrow>How it&apos;s built</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Eight stages, one contract.
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2">
            {HOW_ITS_BUILT.map((step, i) => (
              <Reveal key={step.title} delay={(i % 2) * 0.05}>
                <li className="surface flex h-full gap-4 rounded-2xl border border-border-subtle p-6">
                  <span className="text-gradient font-mono text-sm font-semibold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-[16px] font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
                      {step.body}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="border-y border-border-subtle bg-bg-panel/30">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <Reveal>
              <Eyebrow>Engineering decisions</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                The choices worth asking about.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DECISIONS.map((d, i) => (
                <Reveal key={d.title} delay={(i % 3) * 0.05}>
                  <div className="surface h-full rounded-2xl border border-border-subtle p-6">
                    <h3 className="text-[15px] font-semibold tracking-tight">{d.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
                      {d.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-24 text-center">
          <Reveal>
            <Eyebrow>Stack</Eyebrow>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {STACK.map((item) => (
                <span
                  key={item}
                  className="rounded-lg border border-border-strong bg-bg-panel px-3 py-1.5 font-mono text-[12px] text-text-secondary"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="bg-brand group inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-bg-base shadow-[0_10px_40px_-10px_var(--color-accent)] transition hover:brightness-110"
              >
                Explore the live demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-bg-panel/60 px-5 text-sm font-medium transition hover:border-text-muted hover:bg-bg-elevated"
              >
                <Github className="h-4 w-4" />
                View source
              </a>
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-border-subtle">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-[13px] text-text-muted sm:flex-row">
            <Wordmark />
            <a
              href="https://adiikj.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent"
            >
              Built by adiikj.dev
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
