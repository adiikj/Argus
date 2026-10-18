import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Source, type RawLog } from '@argus/contracts';

// what a shipper may send. 'argus' is reserved for the api's own security
// events: accepting it here would let an ingest token forge them.
export const IngestSource = Source.exclude(['argus']);
export type IngestSource = (typeof IngestSource)['_type'];

// POST /ingest: real logs from outside the pipeline (a Vector or Fluent Bit
// agent tailing nginx / sshd logs) straight onto raw.logs, where the same
// parsers and rules as the simulated traffic pick them up.
//
// Auth is a static bearer token per shipper (INGEST_TOKENS), not a user
// session: agents can't log in, and a token that can only *write logs* is a
// much smaller thing to leak than an analyst account.

export const MAX_RECORDS = 1000;
export const MAX_LINE_BYTES = 16 * 1024;

const sha256 = (value: string) => createHash('sha256').update(value).digest();

// compares digests, not the tokens themselves: equal-length inputs for
// timingSafeEqual, and nothing about a token's length leaks through timing
export function createTokenCheck(tokens: string[]): (presented: string | undefined) => boolean {
  const digests = tokens.map(sha256);
  return (presented) => {
    if (!presented || digests.length === 0) return false;
    const candidate = sha256(presented);
    let ok = false;
    for (const digest of digests) ok = timingSafeEqual(candidate, digest) || ok;
    return ok;
  };
}

export interface IngestResult {
  records: RawLog[];
  rejected: number;
}

// the line itself, under whichever key the shipper uses: Vector emits
// `message`, Fluent Bit's tail input `log` and its systemd input `MESSAGE`
const MESSAGE_KEYS = ['message', 'log', 'MESSAGE', 'line'] as const;

function messageOf(record: Record<string, unknown>): string | undefined {
  for (const key of MESSAGE_KEYS) {
    if (typeof record[key] === 'string') return record[key];
  }
  return undefined;
}

// ISO 8601 (Vector, Fluent Bit with json_date_format iso8601) or epoch
// seconds (Fluent Bit's default `date`). Anything unreadable, or more than a
// few minutes in the future, gets the receive time instead.
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

function timestampOf(record: Record<string, unknown>, now: number): string {
  const raw = record.timestamp ?? record.date ?? record.time;
  const ms =
    typeof raw === 'number' ? raw * 1000 : typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
  if (!Number.isFinite(ms) || ms > now + MAX_CLOCK_SKEW_MS) return new Date(now).toISOString();
  return new Date(ms).toISOString();
}

function toRawLog(
  item: unknown,
  defaultSource: IngestSource | undefined,
  now: number,
): RawLog | undefined {
  const record: Record<string, unknown> =
    typeof item === 'string'
      ? { message: item }
      : item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
  const message = messageOf(record)?.replace(/\r?\n$/, '');
  const source = IngestSource.safeParse(record.source ?? defaultSource);
  if (!message || !source.success || Buffer.byteLength(message) > MAX_LINE_BYTES) return undefined;
  return {
    eventId: randomUUID(),
    timestamp: timestampOf(record, now),
    source: source.data,
    message,
  };
}

// body as Fastify hands it over: parsed JSON (one record or an array), or a
// string for text/plain and NDJSON, one record per line. A line that is a JSON
// object is a record; any other line is the raw log line itself.
export function parseIngestBody(
  body: unknown,
  defaultSource: IngestSource | undefined,
  now: number = Date.now(),
): IngestResult | { error: string } {
  let items: unknown[];
  if (typeof body === 'string') {
    items = body
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        if (!line.trimStart().startsWith('{')) return line;
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return line;
        }
      });
  } else if (Array.isArray(body)) {
    items = body;
  } else if (body && typeof body === 'object') {
    items = [body];
  } else {
    return { error: 'empty body' };
  }
  if (items.length > MAX_RECORDS) return { error: `at most ${MAX_RECORDS} records per request` };

  const records: RawLog[] = [];
  for (const item of items) {
    const log = toRawLog(item, defaultSource, now);
    if (log) records.push(log);
  }
  return { records, rejected: items.length - records.length };
}
