# Argus

> The hundred-eyed watchman — an AI SOC analyst that sees every event.

An event-driven security event analysis platform: a scenario-driven log generator feeds **Kafka**, a
processing monolith normalizes events, runs a rule-based **detection engine**, correlates alerts into
**incidents**, and (optionally) generates **AI incident summaries** — all surfaced on a real-time dark
security-console dashboard.


## Stack

Node.js · TypeScript · Fastify · Kafka (KRaft) · Elasticsearch · PostgreSQL (Prisma) · Next.js ·
WebSockets · Docker Compose · pnpm + Turborepo.

## Repository layout

```
apps/
  generator/    # "fake infrastructure" — emits logs to Kafka + exposes the /simulate attack API
  api/          # processing monolith: streaming, parser, storage, detection, incident, ai, realtime
  dashboard/    # Next.js real-time dashboard
packages/
  contracts/    # Zod schemas + inferred types — the single source of truth
  config/       # env parsing + validation (fail-fast at boot)
  logger/       # pino structured logging + correlation-id helpers
```

## Prerequisites

- Node.js >= 20 (24 recommended — see `.nvmrc`)
- pnpm 10 (`corepack enable` will pick up the pinned version)
- Docker + Docker Compose

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Boot infrastructure (Kafka, Elasticsearch, Postgres)
pnpm infra:up        # docker compose up -d
pnpm infra:logs      # follow logs; wait for healthchecks to pass

# 4. Type-check / lint the workspace
pnpm typecheck
pnpm lint

# 5. Run apps in dev (added as modules are built)
pnpm dev
```

Useful infra commands: `pnpm infra:down` (stop), `pnpm infra:reset` (stop + wipe volumes).

## Status

Scaffolding stage — monorepo, tooling, and infrastructure are in place. Next: shared contracts and
the end-to-end walking skeleton (architecture §1, §12).
