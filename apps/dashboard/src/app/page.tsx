import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RULE_CATALOG, attackUrl } from '@argus/contracts/rules';
import { Github } from '@/components/icons/github';
import { CapabilityCards } from './_components/capability-cards';
import { DefenseLayers } from './_components/defense-layers';
import { HeroMap } from './_components/hero-map';
import { LiveDemo } from './_components/live-demo';
import { PipelineDiagram } from './_components/pipeline-diagram';
import { ProductTour } from './_components/product-tour';
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

const STEPS: [string, string][] = [
  ['Ingest', 'Simulated attacks and real probe traffic from the live server.'],
  ['Stream', 'Kafka, keyed by source.'],
  ['Normalize', 'Three log formats, one validated event.'],
  ['Detect', `${RULES.length} rules: signatures, windows and baselines.`],
  ['Correlate', 'One incident per source, with repeat alerts throttled.'],
  ['Explain', 'GeoIP, AbuseIPDB reputation and a written summary.'],
];

// one account-takeover run, stage by stage
const TRACE: [string, string, string, string?][] = [
  ['22:04:01', 'fired', 'account-takeover'],
  ['22:04:01', 'parsed', '8 auth events'],
  ['22:04:02', 'alert', 'SSH brute force · T1110.001', 'var(--color-severity-high)'],
  ['22:04:02', 'alert', 'Login after brute force · T1078', 'var(--color-severity-critical)'],
  ['22:04:02', 'incident', 'opened for 185.224.128.17'],
  ['22:04:05', 'summary', 'written'],
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
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-20 pb-16 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <div>
            <Reveal>
              <p className="flex items-center gap-2 text-[13.5px] text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Live at argus.buzz
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-6 text-[38px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[48px]">
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
                {RULES.length} detection rules · {TECHNIQUES} ATT&amp;CK techniques · runs with no
                API keys
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.15}>
            <HeroMap />
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
            <PipelineDiagram steps={STEPS} />
          </div>
        </section>

        {/* the console */}
        <section id="console" className="scroll-mt-16 border-t border-border-subtle">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHeading title="Inside the console" />
            </Reveal>
            <Reveal delay={0.06}>
              <ProductTour />
            </Reveal>
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
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHeading title="What it does" />
            </Reveal>
            <Reveal delay={0.06}>
              <CapabilityCards />
            </Reveal>
          </div>
        </section>

        {/* security */}
        <section id="security" className="scroll-mt-16 border-t border-border-subtle bg-bg-panel">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <DefenseLayers heading={<SectionHeading title="Security" />} />
          </div>
        </section>

        {/* closing */}
        <section className="border-t border-border-subtle">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
            <div>
              <h2 className="text-[26px] font-semibold tracking-[-0.01em] sm:text-[30px]">
                Watch it catch an attack.
              </h2>
              <p className="mt-2 max-w-lg text-[16px] text-text-secondary">
                Sign in with the read-only demo and fire a scenario.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryCta>Explore the live demo</PrimaryCta>
                <SourceCta />
              </div>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border-subtle bg-bg-panel">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5 font-mono text-[11px] text-text-muted">
                <span>trace · account-takeover</span>
                <span className="flex items-center gap-1.5 text-severity-ok">
                  <span className="h-1.5 w-1.5 rounded-full bg-severity-ok" />
                  done in 4s
                </span>
              </div>
              <ol className="relative px-4 py-3 font-mono text-[12px]">
                <span
                  aria-hidden
                  className="absolute top-6 bottom-6 left-[94px] w-px bg-border-subtle"
                />
                {TRACE.map(([time, stage, detail, color], i) => (
                  <Reveal key={`${stage}-${i}`} delay={0.15 + i * 0.12}>
                    <li className="relative flex items-center gap-3 py-1.5">
                      <span className="w-[62px] shrink-0 text-text-muted">{time}</span>
                      <span
                        className="relative z-10 h-2 w-2 shrink-0 rounded-full border border-bg-panel"
                        style={{ backgroundColor: color ?? 'var(--color-accent)' }}
                      />
                      <span className="w-[64px] shrink-0 text-text-secondary">{stage}</span>
                      <span className="min-w-0 truncate text-text-primary">{detail}</span>
                    </li>
                  </Reveal>
                ))}
              </ol>
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
