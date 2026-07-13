import { Prisma, type NormalizedEventRow } from '../../generated/prisma/index.js';
import type { NormalizedEvent } from '@argus/contracts';
import type { PrismaClient } from '../incident/index.js';
import type { EventSearchParams } from './events-index.js';

export function eventRowToContract(row: NormalizedEventRow): NormalizedEvent {
  return {
    eventId: row.eventId,
    timestamp: row.timestamp.toISOString(),
    source: row.source as NormalizedEvent['source'],
    sourceIp: row.sourceIp,
    outcome: row.outcome as NormalizedEvent['outcome'],
    username: row.username ?? undefined,
    method: row.method ?? undefined,
    path: row.path ?? undefined,
    statusCode: row.statusCode ?? undefined,
    userAgent: row.userAgent ?? undefined,
    raw: row.raw,
  };
}

export async function indexEventPostgres(
  prisma: PrismaClient,
  event: NormalizedEvent,
): Promise<void> {
  await prisma.normalizedEventRow.upsert({
    where: { eventId: event.eventId },
    create: {
      eventId: event.eventId,
      timestamp: new Date(event.timestamp),
      source: event.source,
      sourceIp: event.sourceIp,
      outcome: event.outcome,
      username: event.username,
      method: event.method,
      path: event.path,
      statusCode: event.statusCode,
      userAgent: event.userAgent,
      raw: event.raw,
    },
    // re-indexing the same eventId (at-least-once redelivery) just overwrites
    // — matches Elasticsearch's `index` (not `create`) semantics.
    update: {},
  });
}

export async function getEventByIdPostgres(
  prisma: PrismaClient,
  eventId: string,
): Promise<NormalizedEvent | undefined> {
  const row = await prisma.normalizedEventRow.findUnique({ where: { eventId } });
  return row ? eventRowToContract(row) : undefined;
}

// mirrors the functional GIN index in the lite_storage_events migration
// exactly (`||`/`coalesce`, not `concat_ws`) so Postgres can use it.
const FTS_EXPRESSION = Prisma.raw(`to_tsvector('simple'::regconfig,
  raw || ' ' || source_ip || ' ' || coalesce(username, '') || ' ' || coalesce(path, '') || ' ' || coalesce(user_agent, ''))`);

// $queryRaw returns raw Postgres column names (snake_case), not Prisma's
// camelCase field mapping — that mapping only applies to the generated
// Client's own query methods, not raw SQL. Alias every column here so the
// result shape matches NormalizedEventRow and eventRowToContract works as-is.
const SELECT_COLUMNS = Prisma.raw(`
  event_id AS "eventId", "timestamp", source, source_ip AS "sourceIp", outcome,
  username, method, path, status_code AS "statusCode", user_agent AS "userAgent", raw
`);

export async function searchEventsPostgres(
  prisma: PrismaClient,
  params: EventSearchParams = {},
): Promise<NormalizedEvent[]> {
  const conditions: Prisma.Sql[] = [];
  if (params.q) {
    conditions.push(
      Prisma.sql`${FTS_EXPRESSION} @@ plainto_tsquery('simple'::regconfig, ${params.q})`,
    );
  }
  if (params.source) {
    conditions.push(Prisma.sql`source = ${params.source}`);
  }
  const where =
    conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

  const rows = await prisma.$queryRaw<NormalizedEventRow[]>(
    Prisma.sql`SELECT ${SELECT_COLUMNS} FROM normalized_events ${where} ORDER BY "timestamp" DESC LIMIT ${params.limit ?? 50}`,
  );
  return rows.map(eventRowToContract);
}
