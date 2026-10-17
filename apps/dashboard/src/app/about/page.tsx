import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RULE_CATALOG } from '@argus/contracts/rules';
import { Github } from '@/components/icons/github';
import { Wordmark } from '../_components/wordmark';
import { Reveal } from '../_components/reveal';

const REPO_URL = 'https://github.com/adiikj/Argus';
const RULE_COUNT = Object.keys(RULE_CATALOG).length;

const BUILD = [
  [
    'Ingestion',
    'Synthetic auth, nginx and API logs, plus real probe traffic from the live server.',
  ],
  ['Parsing', 'Three formats into one Zod-validated event, with an id that traces it end to end.'],
  ['Detection', `${RULE_COUNT} rules: signatures, sliding windows and per-source baselines.`],
  ['Correlation', 'Throttled alerts grouped into one incident per source, stored in Postgres.'],
  ['Enrichment', 'GeoIP from DB-IP, reputation from AbuseIPDB, then an LLM summary.'],
  ['Delivery', 'CI builds and scans the images. The server only pulls them.'],
];

const DECISIONS = [
  [
    'Isolated rule state',
    'Each rule gets its own key namespace, so two rules keyed by the same IP can’t read each other’s counts.',
  ],
  [
    'Proxies trusted by address',
    'Rate limits key on the real client IP, and a forged X-Forwarded-For can’t change it.',
  ],
  [
    'Visitors stay out',
    'Only requests for paths the api doesn’t serve are ingested, so dashboard users never show up as attackers.',
  ],
  [
    'Optional integrations',
    'Every external service is optional. With no keys at all, Argus still runs end to end.',
  ],
];

const STACK = [
  'TypeScript',
  'Node 24',
  'Fastify',
  'Kafka',
  'PostgreSQL',
  'Prisma',
  'Redis',
  'Next.js',
  'WebSockets',
  'Zod',
  'Docker',
  'GitHub Actions',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="glass sticky top-0 z-30 border-b border-border-subtle">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Wordmark />
          <nav className="flex items-center gap-5 text-[13.5px]">
            <Link
              href="/"
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-accent hover:text-accent"
            >
              Open console
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        <section className="pt-20 pb-16">
          <Reveal>
            <h1 className="text-[34px] leading-tight font-semibold tracking-[-0.02em] sm:text-[42px]">
              About Argus
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-text-secondary">
              A portfolio project by adiikj. It’s a working security event pipeline, deployed on a
              small VM and running against real internet traffic.
            </p>
          </Reveal>
        </section>

        <section className="border-t border-border-subtle py-14">
          <h2 className="text-[20px] font-semibold">How it’s built</h2>
          <dl className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
            {BUILD.map(([key, value]) => (
              <div key={key} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
                <dt className="text-[14px] font-medium">{key}</dt>
                <dd className="text-[14.5px] leading-relaxed text-text-secondary">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-border-subtle py-14">
          <h2 className="text-[20px] font-semibold">Decisions worth asking about</h2>
          <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {DECISIONS.map(([title, body]) => (
              <div key={title}>
                <h3 className="text-[15px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border-subtle py-14">
          <h2 className="text-[20px] font-semibold">Stack</h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-text-secondary">
            {STACK.join(' · ')}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="group inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[14px] font-semibold text-accent-ink transition-colors hover:bg-accent-strong"
            >
              Explore the live demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-4 text-[14px] font-medium transition-colors hover:bg-bg-elevated"
            >
              <Github className="h-4 w-4" />
              View source
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8 text-[13px] text-text-muted">
          <Wordmark />
          <a
            href="https://adiikj.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-text-primary"
          >
            adiikj.dev
          </a>
        </div>
      </footer>
    </div>
  );
}
