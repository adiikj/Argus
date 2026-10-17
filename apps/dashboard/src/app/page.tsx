import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RULE_CATALOG, attackUrl } from '@argus/contracts/rules';
import { Github } from '@/components/icons/github';
import { LiveDemo } from './_components/live-demo';
import { Reveal } from './_components/reveal';
import { Wordmark } from './_components/wordmark';

const REPO_URL = 'https://github.com/adiikj/Argus';

const RULES = Object.values(RULE_CATALOG);
const TECHNIQUES = new Set(RULES.map((r) => r.technique.id)).size;

// ATT&CK enterprise matrix order, limited to the tactics Argus covers
const TACTIC_ORDER = [
  'Reconnaissance',
  'Initial Access',
  'Execution',
  'Defense Evasion',
  'Credential Access',
  'Impact',
];
const MATRIX = TACTIC_ORDER.map((tactic) => ({
  tactic,
  rules: RULES.filter((r) => r.tactic.name === tactic),
})).filter((col) => col.rules.length > 0);

const STEPS = [
  ['Ingest', 'Simulated attacks and real probe traffic from the live server.'],
  ['Stream', 'Kafka, keyed by source.'],
  ['Normalize', 'Three log formats, one validated event.'],
  ['Detect', `${RULES.length} rules: signatures, windows and baselines.`],
  ['Correlate', 'One incident per source, with repeat alerts throttled.'],
  ['Explain', 'GeoIP, AbuseIPDB reputation and a written summary.'],
];

const CAPABILITIES = [
  ['Real attack traffic', 'Scanners probing the live server become real incidents.'],
  ['Written summaries', 'Each incident gets a short account of what happened and what to do next.'],
  ['GeoIP and threat intel', 'Every public source is located and checked against AbuseIPDB.'],
  ['Alert throttling', 'A scanner sending thousands of requests stays one readable incident.'],
  ['Attack simulator', 'Ten scenarios you can fire at the live pipeline.'],
];

const SECURITY = [
  ['Access', 'Admin, analyst and read-only roles. No public sign-up.'],
  ['Transport', 'TLS, strict CSP and HSTS.'],
  ['Abuse', 'Rate limits on the real client IP.'],
  ['Supply chain', 'CodeQL, gitleaks and Trivy on every push.'],
  ['Runtime', 'Scanned images, non-root containers.'],
];

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.01em] sm:text-[30px]">
        {title}
      </h2>
      {children && (
        <p className="mt-3 text-[16px] leading-relaxed text-text-secondary">{children}</p>
      )}
    </div>
  );
}

function PrimaryCta({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/login"
      className="group inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[14px] font-semibold text-accent-ink transition-colors hover:bg-accent-strong"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SourceCta() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-4 text-[14px] font-medium text-text-primary transition-colors hover:bg-bg-elevated"
    >
      <Github className="h-4 w-4" />
      View source
    </a>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="glass sticky top-0 z-30 border-b border-border-subtle">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <nav className="hidden items-center gap-7 text-[13.5px] text-text-secondary md:flex">
            <a href="#how" className="transition-colors hover:text-text-primary">
              How it works
            </a>
            <a href="#coverage" className="transition-colors hover:text-text-primary">
              Coverage
            </a>
            <a href="#security" className="transition-colors hover:text-text-primary">
              Security
            </a>
            <Link href="/about" className="transition-colors hover:text-text-primary">
              About
            </Link>
          </nav>
          <Link
            href="/login"
            className="rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Open console
          </Link>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-14 sm:pt-24">
          <Reveal>
            <p className="flex items-center gap-2 text-[13.5px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live at argus.buzz
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-6 max-w-3xl text-[38px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[50px]">
              See every attack.
              <br />
              <span className="text-text-secondary">Understand every incident.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-text-secondary">
              Argus streams security logs through Kafka, detects attacks with {RULES.length} rules
              mapped to MITRE ATT&amp;CK, and explains each incident in plain language.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryCta>Explore the live demo</PrimaryCta>
              <SourceCta />
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-8 text-[13.5px] text-text-muted">
              {RULES.length} detection rules · {TECHNIQUES} ATT&amp;CK techniques · runs with no API
              keys
            </p>
          </Reveal>
        </section>

        {/* the product */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Reveal delay={0.1}>
            <LiveDemo />
          </Reveal>
        </section>

        {/* how it works */}
        <section id="how" className="scroll-mt-16 border-t border-border-subtle">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHeading title="How it works" />
            </Reveal>
            <ol className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(([title, body], i) => (
                <Reveal key={title} delay={(i % 3) * 0.05}>
                  <li className="border-t border-border-strong pt-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[12px] text-accent">{i + 1}</span>
                      <h3 className="text-[16px] font-semibold">{title}</h3>
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* coverage */}
        <section id="coverage" className="scroll-mt-16 border-t border-border-subtle bg-bg-panel">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHeading title="ATT&CK coverage">
                Every rule maps to a MITRE ATT&amp;CK technique.
              </SectionHeading>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="mt-10 overflow-x-auto">
                <div
                  className="grid min-w-[860px] gap-px overflow-hidden rounded-md border border-border-subtle bg-border-subtle"
                  style={{ gridTemplateColumns: `repeat(${MATRIX.length}, minmax(0, 1fr))` }}
                >
                  {MATRIX.map((col) => (
                    <div key={col.tactic} className="bg-bg-base">
                      <div className="border-b border-border-subtle px-3 py-3">
                        <div className="text-[13px] font-semibold">{col.tactic}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                          {col.rules[0]!.tactic.id}
                        </div>
                      </div>
                      <div className="space-y-px">
                        {col.rules.map((rule) => (
                          <a
                            key={rule.id}
                            href={attackUrl(rule.technique.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-2.5 transition-colors hover:bg-bg-elevated"
                          >
                            <div className="font-mono text-[11.5px] text-accent">
                              {rule.technique.id}
                            </div>
                            <div className="mt-0.5 text-[13px] leading-snug text-text-primary">
                              {rule.name}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-[13px] text-text-muted">
                {RULES.length} rules, {TECHNIQUES} techniques, {MATRIX.length} of the 14 enterprise
                tactics.
              </p>
            </Reveal>
          </div>
        </section>

        {/* capabilities */}
        <section className="border-t border-border-subtle">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-3">
            <Reveal>
              <SectionHeading title="What it does" />
            </Reveal>
            <dl className="divide-y divide-border-subtle border-y border-border-subtle lg:col-span-2">
              {CAPABILITIES.map(([title, body], i) => (
                <Reveal key={title} delay={i * 0.04}>
                  <div className="py-5">
                    <dt className="text-[16px] font-semibold">{title}</dt>
                    <dd className="mt-1.5 text-[14.5px] leading-relaxed text-text-secondary">
                      {body}
                    </dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* security */}
        <section id="security" className="scroll-mt-16 border-t border-border-subtle bg-bg-panel">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-3">
            <Reveal>
              <SectionHeading title="Security" />
            </Reveal>
            <dl className="divide-y divide-border-subtle border-y border-border-subtle lg:col-span-2">
              {SECURITY.map(([key, value]) => (
                <div key={key} className="grid gap-1 py-4 sm:grid-cols-[150px_1fr] sm:gap-6">
                  <dt className="text-[14px] font-medium text-text-primary">{key}</dt>
                  <dd className="text-[14.5px] leading-relaxed text-text-secondary">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* closing */}
        <section className="border-t border-border-subtle">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center">
            <div>
              <h2 className="text-[26px] font-semibold tracking-[-0.01em] sm:text-[30px]">
                Watch it catch an attack.
              </h2>
              <p className="mt-2 max-w-lg text-[16px] text-text-secondary">
                Sign in with the read-only demo and fire a scenario.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <PrimaryCta>Explore the live demo</PrimaryCta>
              <SourceCta />
            </div>
          </div>
        </section>

        <footer className="border-t border-border-subtle">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[13px] text-text-muted sm:flex-row">
            <Wordmark />
            <div className="flex items-center gap-6">
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
                className="transition-colors hover:text-text-primary"
              >
                adiikj.dev
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
