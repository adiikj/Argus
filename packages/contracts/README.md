# @argus/contracts

The single source of truth for every event that crosses a boundary (Kafka, HTTP, DB). Each schema is
a Zod object; we export the inferred type alongside it so the whole monorepo gets runtime validation
and static types from one definition (architecture §3).

```ts
export const NormalizedEvent = z.object({ ... });
export type NormalizedEvent = z.infer<typeof NormalizedEvent>;
```

## Schemas to implement

Start with `RawLog` + `NormalizedEvent` — that's enough for the walking skeleton.

- **RawLog** — per source (`auth` | `api-gateway` | `nginx`); what the generator emits.
- **NormalizedEvent** — the one internal schema everything downstream consumes.
- **Alert** — output of a detection rule; references the triggering event ids.
- **Incident** — a correlated group of alerts (timeline, severity, event ids).
- **IncidentSummary** — AI output: `summary`, `iocs[]`, `recommendedActions[]`.

## Conventions

- Every event carries `eventId` (UUID), assigned by the generator at creation. It doubles as the
  correlation/trace id threaded end to end (§4, §10).
- Timestamps use `z.string().datetime()`. Keep field names consistent across schemas.
