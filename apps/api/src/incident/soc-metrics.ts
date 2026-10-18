import type { DurationStat, RuleMetrics, SocMetrics } from '@argus/contracts';
import type { PrismaClient } from '../../generated/prisma/index.js';

export const SOC_METRICS_DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

// ?days= from the query string, bounded; junk falls back to the default
export function clampDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n < 1) return SOC_METRICS_DEFAULT_DAYS;
  return Math.min(Math.floor(n), MAX_DAYS);
}

interface DurationRow {
  mean: number | null;
  median: number | null;
  samples: number;
}

function toStat(row: DurationRow | undefined): DurationStat {
  return { mean: row?.mean ?? null, median: row?.median ?? null, samples: row?.samples ?? 0 };
}

function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

// Everything is aggregated in Postgres: alerts and incidents are never
// pruned, so loading rows to average them in JS would get slower every day.
//
// - MTTD: first evidence (the earliest firstSeenAt among the incident's
//   alerts) -> incident opened. Clamped at 0: a log line stamped a moment in
//   the future by a skewed clock shouldn't produce negative detection time.
// - MTTA: opened -> first move out of open (acknowledgedAt).
// - MTTR: opened -> closed, resolved and false positive alike.
// - False-positive rate: of the closed incidents, the share closed as a
//   false positive. Per rule it counts incidents the rule contributed to,
//   so one false-positive incident counts against every rule in it.
//
// The window is by incident creation (by alert time for the rule table).
export async function getSocMetrics(prisma: PrismaClient, days: number): Promise<SocMetrics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);
  // columns are timestamp without time zone holding UTC wall time; an ISO
  // string cast to ::timestamp drops the Z and compares like for like
  const from = since.toISOString();

  const [totals] = await prisma.$queryRaw<
    Array<{ incidents: number; backlog: number; closed: number; false_positives: number }>
  >`
    SELECT COUNT(*)::int AS incidents,
           COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged'))::int AS backlog,
           COUNT(*) FILTER (WHERE status IN ('resolved', 'false_positive'))::int AS closed,
           COUNT(*) FILTER (WHERE status = 'false_positive')::int AS false_positives
    FROM incidents WHERE created_at >= ${from}::timestamp`;

  const [mttd] = await prisma.$queryRaw<DurationRow[]>`
    WITH d AS (
      SELECT GREATEST(0, EXTRACT(EPOCH FROM i.created_at - a.first_seen))::float8 AS s
      FROM incidents i
      JOIN (SELECT incident_id, MIN(first_seen_at) AS first_seen FROM alerts
            WHERE first_seen_at IS NOT NULL GROUP BY incident_id) a USING (incident_id)
      WHERE i.created_at >= ${from}::timestamp)
    SELECT AVG(s) AS mean, percentile_cont(0.5) WITHIN GROUP (ORDER BY s) AS median,
           COUNT(*)::int AS samples FROM d`;

  const [mtta] = await prisma.$queryRaw<DurationRow[]>`
    WITH d AS (
      SELECT GREATEST(0, EXTRACT(EPOCH FROM acknowledged_at - created_at))::float8 AS s
      FROM incidents WHERE created_at >= ${from}::timestamp AND acknowledged_at IS NOT NULL)
    SELECT AVG(s) AS mean, percentile_cont(0.5) WITHIN GROUP (ORDER BY s) AS median,
           COUNT(*)::int AS samples FROM d`;

  const [mttr] = await prisma.$queryRaw<DurationRow[]>`
    WITH d AS (
      SELECT GREATEST(0, EXTRACT(EPOCH FROM closed_at - created_at))::float8 AS s
      FROM incidents WHERE created_at >= ${from}::timestamp AND closed_at IS NOT NULL)
    SELECT AVG(s) AS mean, percentile_cont(0.5) WITHIN GROUP (ORDER BY s) AS median,
           COUNT(*)::int AS samples FROM d`;

  const ruleRows = await prisma.$queryRaw<
    Array<{
      rule_id: string;
      alerts: number;
      incidents: number;
      closed: number;
      false_positives: number;
      mttd: number | null;
    }>
  >`
    SELECT a.rule_id,
           COUNT(*)::int AS alerts,
           COUNT(DISTINCT a.incident_id)::int AS incidents,
           COUNT(DISTINCT a.incident_id)
             FILTER (WHERE i.status IN ('resolved', 'false_positive'))::int AS closed,
           COUNT(DISTINCT a.incident_id) FILTER (WHERE i.status = 'false_positive')::int
             AS false_positives,
           -- GREATEST(0, NULL) is 0, not NULL: filter out pre-migration alerts
           AVG(GREATEST(0, EXTRACT(EPOCH FROM a.timestamp - a.first_seen_at)))
             FILTER (WHERE a.first_seen_at IS NOT NULL)::float8 AS mttd
    FROM alerts a JOIN incidents i USING (incident_id)
    WHERE a.timestamp >= ${from}::timestamp
    GROUP BY a.rule_id
    ORDER BY alerts DESC`;

  const dailyRows = await prisma.$queryRaw<Array<{ date: string; opened: number; closed: number }>>`
    WITH days AS (
           SELECT generate_series(date_trunc('day', ${from}::timestamp),
                                  date_trunc('day', now() AT TIME ZONE 'UTC'),
                                  interval '1 day') AS day),
         opened AS (
           SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS n FROM incidents
           WHERE created_at >= date_trunc('day', ${from}::timestamp) GROUP BY 1),
         closed AS (
           SELECT date_trunc('day', closed_at) AS day, COUNT(*)::int AS n FROM incidents
           WHERE closed_at >= date_trunc('day', ${from}::timestamp) GROUP BY 1)
    SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
           COALESCE(opened.n, 0) AS opened, COALESCE(closed.n, 0) AS closed
    FROM days LEFT JOIN opened USING (day) LEFT JOIN closed USING (day)
    ORDER BY days.day`;

  const rules: RuleMetrics[] = ruleRows.map((r) => ({
    ruleId: r.rule_id,
    alerts: r.alerts,
    incidents: r.incidents,
    closed: r.closed,
    falsePositives: r.false_positives,
    falsePositiveRate: rate(r.false_positives, r.closed),
    mttdSeconds: r.mttd,
  }));

  const t = totals ?? { incidents: 0, backlog: 0, closed: 0, false_positives: 0 };
  return {
    days,
    since: from,
    incidents: t.incidents,
    backlog: t.backlog,
    closed: t.closed,
    falsePositives: t.false_positives,
    falsePositiveRate: rate(t.false_positives, t.closed),
    mttd: toStat(mttd),
    mtta: toStat(mtta),
    mttr: toStat(mttr),
    rules,
    daily: dailyRows,
  };
}
