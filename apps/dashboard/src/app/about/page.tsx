import Link from 'next/link';
import { Wordmark } from '../_components/wordmark';

const HOW_ITS_BUILT = [
  {
    n: '01',
    title: 'Event-driven ingestion',
    body: 'A scenario-driven generator emits realistic security logs — auth, network, process — onto Kafka (KRaft mode). A /simulate API fires attacks on demand.',
  },
  {
    n: '02',
    title: 'Schema-validated at the boundary',
    body: 'Every raw log is parsed and validated against a Zod contract before anything downstream sees it — one canonical NormalizedEvent shape, an eventId threaded end-to-end as a trace id.',
  },
  {
    n: '03',
    title: 'Stateless + stateful detection',
    body: 'A rule engine runs both signature checks (SQLi, directory enumeration) and windowed/statistical rules (brute-force bursts, per-entity rolling-baseline anomaly scoring) against the same Rule interface.',
  },
  {
    n: '04',
    title: 'Correlation into incidents',
    body: 'Related alerts from the same entity within a time window collapse into one incident, transactionally persisted in Postgres via Prisma — one attacker, one story, not a wall of alerts.',
  },
  {
    n: '05',
    title: 'AI summarization, degrading gracefully',
    body: 'An LLMProvider interface (Gemini/Groq via plain fetch) drafts a plain-language incident summary behind a debounced job queue — falling back to a deterministic template with zero API keys.',
  },
  {
    n: '06',
    title: 'Real-time, traceable console',
    body: 'Every alert, incident, and summary streams live over WebSockets. The pipeline trace view follows one event by its eventId across Kafka, Elasticsearch, and Postgres — proof, not a diagram.',
  },
];

const DECISIONS = [
  {
    title: 'CQRS-lite storage split',
    body: 'Elasticsearch owns the searchable event stream; Postgres owns the relational incident/alert/summary graph. Each store does the one thing it is actually good at.',
  },
  {
    title: 'eventId end-to-end',
    body: 'Every event carries a UUID set at the generator that doubles as its correlation id all the way through parsing, detection, correlation, and the AI summary — the trace view is a real query against it, not a mock.',
  },
  {
    title: 'Mechanically enforced module boundaries',
    body: 'eslint-plugin-boundaries fails the build on a deep cross-module import. Each module in apps/api/src talks to the others only through its public index.ts or the internal event bus — a real constraint, not a convention.',
  },
  {
    title: 'Three-tier LLM degradation',
    body: 'Real LLM → deterministic template → still fully-typed output. The whole system runs with zero API keys and the dashboard never has to know which tier produced a summary.',
  },
  {
    title: 'Redis is optional, not required',
    body: 'The detection engine’s sliding-window state and the internal event bus both have a Redis-backed implementation behind the same interface, gated on one REDIS_URL env var — unset, everything stays in-process.',
  },
];

const STACK = [
  'TypeScript (strict)',
  'Node 24',
  'Fastify',
  'Kafka (KRaft)',
  'Elasticsearch',
  'PostgreSQL + Prisma',
  'Next.js',
  'WebSockets',
  'Zod',
  'Docker Compose',
  'pnpm + Turborepo',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-base/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Wordmark />
          <nav className="flex items-center gap-6 font-mono text-xs text-text-secondary">
            <Link href="/" className="transition-colors hover:text-text-primary">
              Home
            </Link>
            <Link href="/login" className="transition-colors hover:text-accent">
              live console →
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border-subtle">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-text-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-secondary) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel px-3 py-1 font-mono text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-accent" />
              How this is built
            </span>
            <h1 className="mx-auto mt-8 max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              An event-driven security analysis platform, built to demonstrate real distributed
              systems — not just claim it.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-text-secondary">
              A Kafka-based log pipeline, a stateless-and-stateful detection engine, Postgres-backed
              incident correlation, LLM incident summarization with a deterministic fallback, and a
              real-time console with a live pipeline trace view.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">
            How it&apos;s built
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-2">
            {HOW_ITS_BUILT.map((step) => (
              <div key={step.n} className="bg-bg-panel p-7">
                <span className="font-mono text-sm text-accent">{step.n}</span>
                <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border-subtle bg-bg-panel/40">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">
              Engineering decisions
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {DECISIONS.map((d) => (
                <div
                  key={d.title}
                  className="rounded-2xl border border-border-subtle bg-bg-panel p-6"
                >
                  <h3 className="text-base font-semibold text-text-primary">{d.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Stack
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {STACK.map((item) => (
              <span
                key={item}
                className="rounded-md border border-border-subtle bg-bg-panel px-3 py-1.5 font-mono text-xs text-text-secondary"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-mono text-sm font-semibold text-bg-base transition-transform hover:-translate-y-0.5"
            >
              Launch the console
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="https://github.com"
              className="rounded-lg border border-border-subtle px-6 py-3 font-mono text-sm text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
            >
              View source
            </a>
          </div>
        </section>

        <footer className="border-t border-border-subtle">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-6 py-8 font-mono text-xs text-text-secondary sm:flex-row">
            <Wordmark />
            <span>The hundred-eyed watchman for your logs.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
