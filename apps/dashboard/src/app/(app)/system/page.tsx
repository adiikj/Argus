'use client';

import { motion } from 'framer-motion';
import { useSystemHealth } from '@/lib/use-system-health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';

function fadeIn(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] as const },
  };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return <Badge variant={ok ? 'low' : 'critical'}>{label}</Badge>;
}

const ES_STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  green: 'low',
  yellow: 'medium',
  red: 'critical',
};

export default function SystemHealthPage() {
  const { data: health, isError, isLoading } = useSystemHealth();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-text-primary">System Health</h1>

      {isLoading && <p className="text-sm text-text-secondary">Checking system health…</p>}
      {isError && (
        <p className="text-sm text-severity-critical">
          Couldn&apos;t reach the api&apos;s health endpoint.
        </p>
      )}

      {health && (
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div {...fadeIn(0)}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Kafka</CardTitle>
                <StatusBadge ok={health.kafka.ok} label={health.kafka.ok ? 'healthy' : 'down'} />
              </CardHeader>
              <CardContent className="p-0">
                {health.kafka.consumerLag.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-text-secondary">
                    No consumer group data.
                  </div>
                ) : (
                  <ul className="divide-y divide-border-subtle">
                    {health.kafka.consumerLag.map((entry) => (
                      <li
                        key={`${entry.groupId}-${entry.topic}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-text-primary">
                            {entry.groupId}
                          </div>
                          <div className="truncate font-mono text-[10px] text-text-secondary">
                            {entry.topic}
                          </div>
                        </div>
                        <span
                          className={
                            entry.lag > 0
                              ? 'shrink-0 font-mono text-xs tabular-nums text-severity-medium'
                              : 'shrink-0 font-mono text-xs tabular-nums text-text-secondary'
                          }
                        >
                          lag {entry.lag}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn(0.08)}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Elasticsearch</CardTitle>
                <Badge
                  variant={
                    (health.elasticsearch.status &&
                      ES_STATUS_VARIANT[health.elasticsearch.status]) ||
                    'critical'
                  }
                >
                  {health.elasticsearch.status ?? 'unreachable'}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-secondary">
                  Cluster health of the <code className="font-mono text-xs">normalized-events</code>{' '}
                  index backing store.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn(0.16)}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Postgres</CardTitle>
                <StatusBadge
                  ok={health.postgres.ok}
                  label={health.postgres.ok ? 'connected' : 'unreachable'}
                />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-secondary">
                  {health.postgres.latencyMs !== null
                    ? `Round-trip: ${health.postgres.latencyMs}ms`
                    : 'No response from the database.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </main>
  );
}
