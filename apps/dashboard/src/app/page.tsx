import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Check,
  Crosshair,
  Filter,
  Globe2,
  Lock,
  Radar,
  ShieldCheck,
} from 'lucide-react';
import { RULE_CATALOG, attackUrl } from '@argus/contracts/rules';
import { Github } from '@/components/icons/github';
import { LiveDemo } from './_components/live-demo';
import { Reveal } from './_components/reveal';
import { Wordmark } from './_components/wordmark';

const REPO_URL = 'https://github.com/adiikj/Argus';

const RULES = Object.values(RULE_CATALOG);
const TECHNIQUES = new Set(RULES.map((r) => r.technique.id)).size;
const TACTICS = [...new Set(RULES.map((r) => r.tactic.name))];

const STACK = ['Kafka', 'Fastify', 'PostgreSQL', 'Redis', 'Prisma', 'Next.js', 'Docker', 'Zod'];

const PIPELINE = [
  { title: 'Ingest', body: 'Synthetic scenarios + real nginx probe traffic' },
  { title: 'Stream', body: 'Kafka topics, keyed per source, at-least-once' },
  { title: 'Normalize', body: 'Three log formats → one Zod-validated event' },
  { title: 'Detect', body: `${RULES.length} rules, stateless + windowed, throttled` },
  { title: 'Correlate', body: 'Alerts fold into incidents per source' },
  { title: 'Enrich & explain', body: 'GeoIP, AbuseIPDB, then an LLM summary' },
];

const HARDENING = [
  'Role-based access — admin, analyst, read-only demo',
  'Sign-up locked on public deploys; accounts via CLI',
  'Strict CSP, HSTS, no-sniff, frame-deny on every response',
  'Rate limits keyed on the real client IP behind the proxy',
  'CodeQL, gitleaks, Trivy and an SBOM on every push',
  'Images scanned before they ship; containers run non-root',
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
      <span className="bg-brand h-px w-6" />
      {children}
    </span>
  );
}

function PrimaryCta({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/login"
      className="bg-brand group inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-bg-base shadow-[0_10px_40px_-10px_var(--color-accent)] transition hover:brightness-110"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function GithubCta() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-bg-panel/60 px-5 text-sm font-medium text-text-primary transition hover:border-text-muted hover:bg-bg-elevated"
    >
      <Github className="h-4 w-4" />
      View source
    </a>
  );
}

function BentoCard({
  icon: Icon,
  title,
  body,
  className = '',
  children,
}: {
  icon: typeof Radar;
  title: string;
  body: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`surface group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle p-6 transition-colors hover:border-border-strong ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-accent/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-bg-elevated text-accent">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{body}</p>
      {children && <div className="mt-6 flex-1">{children}</div>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg-base text-text-primary">
      <header className="glass sticky top-0 z-30 border-b border-border-subtle/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <nav className="hidden items-center gap-8 text-[13px] text-text-secondary md:flex">
            <a href="#pipeline" className="transition-colors hover:text-text-primary">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-text-primary">
              Features
            </a>
            <a href="#coverage" className="transition-colors hover:text-text-primary">
              ATT&amp;CK coverage
            </a>
            <Link href="/about" className="transition-colors hover:text-text-primary">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="hidden rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary sm:block"
            >
              <Github className="h-4 w-4" />
            </a>
            <Link
              href="/login"
              className="rounded-lg border border-border-strong bg-bg-panel px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:border-accent/50 hover:text-accent"
            >
              Open console
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="relative">
          <div
            aria-hidden
            className="bg-grid mask-radial pointer-events-none absolute inset-0 opacity-60"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 h-[520px] w-[900px] -translate-x-1/2 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-accent-2)_14%,transparent),transparent)]"
          />
          <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-14 text-center sm:pt-28">
            <Reveal>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-bg-panel/70 py-1 pr-3 pl-1 text-[12px] text-text-secondary backdrop-blur transition-colors hover:border-accent/40"
              >
                <span className="bg-brand rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold text-bg-base">
                  LIVE
                </span>
                Running on real internet traffic at argus.buzz
                <ArrowRight className="h-3 w-3" />
              </a>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mx-auto mt-8 max-w-4xl text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[68px]">
                Every attack, seen.
                <br />
                <span className="text-gradient">Every incident, explained.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-text-secondary">
                Argus streams security logs through Kafka, runs {RULES.length} detection rules
                mapped to MITRE ATT&amp;CK, correlates alerts into incidents, enriches them with
                GeoIP and threat intel, and has an LLM write the analyst&apos;s first draft — all
                live.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <PrimaryCta>Explore the live demo</PrimaryCta>
                <GithubCta />
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
                {STACK.map((tech) => (
                  <span key={tech}>{tech}</span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="relative mx-auto max-w-6xl px-6 pb-24">
            <Reveal delay={0.1}>
              <LiveDemo />
            </Reveal>
          </div>
        </section>

        {/* numbers */}
        <section className="border-y border-border-subtle bg-bg-panel/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
            {[
              [String(RULES.length), 'detection rules'],
              [String(TECHNIQUES), 'ATT&CK techniques'],
              [String(TACTICS.length), 'ATT&CK tactics'],
              ['0', 'API keys required to run'],
            ].map(([value, label], i) => (
              <div
                key={label}
                className={`px-6 py-10 text-center ${i > 0 ? 'lg:border-l' : ''} ${i % 2 === 1 ? 'border-l' : ''} border-border-subtle`}
              >
                <div className="text-gradient font-mono text-4xl font-semibold tracking-tight">
                  {value}
                </div>
                <div className="mt-2 text-sm text-text-secondary">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* pipeline */}
        <section id="pipeline" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-28">
          <Reveal className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              One event-driven pipeline, from raw log line to explained incident.
            </h2>
            <p className="mt-4 text-text-secondary">
              Every stage is its own module behind a typed contract — any of them could be split out
              as a service without touching the others.
            </p>
          </Reveal>

          <div className="relative mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div
              aria-hidden
              className="absolute top-7 right-8 left-8 hidden h-px overflow-hidden bg-border-strong lg:block"
            >
              <div className="animate-beam h-full w-1/4 bg-[linear-gradient(90deg,transparent,var(--color-accent),transparent)]" />
            </div>
            {PIPELINE.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.06}>
                <div className="relative">
                  <div className="surface relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border-strong font-mono text-sm text-accent lg:mx-0">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="mt-4 text-center text-[15px] font-semibold lg:text-left">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-center text-[13px] leading-relaxed text-text-secondary lg:text-left">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* features */}
        <section
          id="features"
          className="scroll-mt-20 border-t border-border-subtle bg-bg-panel/30"
        >
          <div className="mx-auto max-w-6xl px-6 py-28">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow>Capabilities</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built like a real SOC tool, not a dashboard demo.
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              <Reveal className="md:col-span-2">
                <BentoCard
                  icon={Radar}
                  title="Real attack traffic, not just a simulator"
                  body="nginx writes every request for a path the api doesn't serve to a probe log, and Argus tails it into the same pipeline. Internet scanners hitting the live deployment become real incidents, with real GeoIP pins."
                  className="h-full"
                >
                  <div className="rounded-xl border border-border-subtle bg-bg-base/70 p-4 font-mono text-[11.5px] leading-6">
                    {[
                      ['GET /.env', '404', 'dir-enumeration'],
                      [
                        'GET /cgi-bin/luci/;stok=/locale?…$(id>`wget…`)',
                        '404',
                        'command-injection',
                      ],
                      ['GET /static/../../../../etc/passwd', '400', 'path-traversal'],
                      ['GET /wp-login.php', '404', 'suppressed · throttled'],
                    ].map(([req, status, rule]) => (
                      <div key={req} className="flex items-center gap-3">
                        <span className="text-text-muted">192.0.2.10</span>
                        <span className="min-w-0 flex-1 truncate text-text-secondary">{req}</span>
                        <span className="text-text-muted">{status}</span>
                        <span className="hidden text-accent sm:inline">{rule}</span>
                      </div>
                    ))}
                  </div>
                </BentoCard>
              </Reveal>

              <Reveal delay={0.06}>
                <BentoCard
                  icon={Brain}
                  title="AI incident summaries"
                  body="An LLM gets the alerts, their ATT&CK techniques and the source's reputation, and writes the story plus next steps. No key? A deterministic template keeps it running."
                  className="h-full"
                />
              </Reveal>

              <Reveal delay={0.04}>
                <BentoCard
                  icon={Globe2}
                  title="GeoIP + threat intel"
                  body="Every source IP is located (DB-IP) and scored by AbuseIPDB — cached, quota-capped, and never sent out for demo or internal addresses."
                  className="h-full"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-text-secondary">abuse confidence</span>
                      <span className="text-severity-critical">100 / 100</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                      <div className="h-full w-full rounded-full bg-severity-critical" />
                    </div>
                    <div className="font-mono text-[11px] text-text-muted">
                      4,312 reports · data center · NL
                    </div>
                  </div>
                </BentoCard>
              </Reveal>

              <Reveal delay={0.08}>
                <BentoCard
                  icon={Filter}
                  title="Noise under control"
                  body="Alerts throttle per rule and source, so a scanner sending thousands of requests stays one readable incident — the next alert says how many it stood in for."
                  className="h-full"
                >
                  <div className="rounded-lg border border-border-subtle bg-bg-base/70 px-3 py-2 font-mono text-[11px] text-text-secondary">
                    Sensitive path probe: /.env{' '}
                    <span className="text-accent">(+412 similar suppressed)</span>
                  </div>
                </BentoCard>
              </Reveal>

              <Reveal delay={0.12}>
                <BentoCard
                  icon={Crosshair}
                  title="Attack simulator"
                  body="Ten scenarios — account takeover, spraying, SQLi, traversal, XSS, command injection — fired on demand at the live pipeline, each proven by a test to trip its rule."
                  className="h-full"
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ATT&CK coverage */}
        <section id="coverage" className="scroll-mt-20 border-t border-border-subtle">
          <div className="mx-auto grid max-w-6xl gap-14 px-6 py-28 lg:grid-cols-5">
            <Reveal className="lg:col-span-2">
              <Eyebrow>MITRE ATT&amp;CK</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                Detections speak the analyst&apos;s language.
              </h2>
              <p className="mt-4 text-text-secondary">
                Every rule maps to a technique and tactic from one shared catalog — the same source
                drives the console&apos;s badges, its kill-chain view, the AI prompts and this list,
                so they can&apos;t drift apart.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {TACTICS.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border-strong bg-bg-panel px-3 py-1 text-[12px] text-text-secondary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.08} className="lg:col-span-3">
              <div className="surface overflow-hidden rounded-2xl border border-border-subtle">
                <ul className="divide-y divide-border-subtle">
                  {RULES.map((rule) => (
                    <li key={rule.id} className="flex items-center gap-4 px-5 py-3">
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{rule.name}</span>
                      <span className="hidden text-[12px] text-text-muted sm:inline">
                        {rule.tactic.name}
                      </span>
                      <a
                        href={attackUrl(rule.technique.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-[84px] shrink-0 rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 text-center font-mono text-[11px] text-accent transition-colors hover:bg-accent/20"
                      >
                        {rule.technique.id}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* hardening */}
        <section className="border-t border-border-subtle bg-bg-panel/30">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
            <Reveal>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-bg-elevated text-accent">
                <Lock className="h-5 w-5" />
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight">
                A security tool that takes its own security seriously.
              </h2>
              <p className="mt-4 text-text-secondary">
                Hardened like a production service — because a SIEM with a weak perimeter is the
                first thing an attacker goes after.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <ul className="grid gap-3">
                {HARDENING.map((item) => (
                  <li
                    key={item}
                    className="surface flex items-center gap-3 rounded-xl border border-border-subtle px-4 py-3 text-[14px]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-severity-ok/15 text-severity-ok">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* closing cta */}
        <section className="relative overflow-hidden border-t border-border-subtle">
          <div
            aria-hidden
            className="bg-dots mask-radial pointer-events-none absolute inset-0 opacity-70"
          />
          <div
            aria-hidden
            className="animate-glow pointer-events-none absolute inset-x-0 top-0 mx-auto h-72 max-w-3xl rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-accent)_25%,transparent),transparent)] blur-2xl"
          />
          <Reveal className="relative mx-auto max-w-3xl px-6 py-28 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border-strong bg-bg-elevated text-accent">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              Watch it catch an attack.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-text-secondary">
              Sign in with the read-only demo, fire a scenario from the simulator, and follow it
              from log line to AI summary in seconds.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <PrimaryCta>Explore the live demo</PrimaryCta>
              <GithubCta />
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-border-subtle">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[13px] text-text-muted sm:flex-row">
            <div className="flex items-center gap-4">
              <Wordmark />
              <span className="hidden sm:inline">Security event analysis, live.</span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/about" className="transition-colors hover:text-text-primary">
                About
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-text-primary"
              >
                GitHub
              </a>
              <a
                href="https://adiikj.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-accent"
              >
                Built by adiikj.dev
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
