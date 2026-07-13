import type { Kafka } from 'kafkajs';
import type { PrismaClient } from '../incident/index.js';
import type { EventStore } from '../storage/index.js';
import { TOPICS, type Topic } from '../streaming/index.js';

// every consumer group actually running in the composition root (index.ts) —
// kept in sync by hand since there's no registry to derive it from.
const CONSUMER_GROUPS: Array<{ groupId: string; topic: Topic }> = [
  { groupId: 'api-parser', topic: TOPICS.RAW_LOGS },
  { groupId: 'api-es-writer', topic: TOPICS.EVENTS_NORMALIZED },
  { groupId: 'api-detection', topic: TOPICS.EVENTS_NORMALIZED },
  { groupId: 'api-incident', topic: TOPICS.ALERTS },
];

export interface ConsumerLag {
  groupId: string;
  topic: string;
  lag: number;
}

export interface SystemHealth {
  kafka: { ok: boolean; consumerLag: ConsumerLag[] };
  search: { ok: boolean; backend: 'elasticsearch' | 'postgres'; status: string | null };
  postgres: { ok: boolean; latencyMs: number | null };
}

async function getConsumerLag(kafka: Kafka): Promise<{ ok: boolean; consumerLag: ConsumerLag[] }> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const consumerLag = await Promise.all(
      CONSUMER_GROUPS.map(async ({ groupId, topic }) => {
        const [topicOffsets, groupOffsets] = await Promise.all([
          admin.fetchTopicOffsets(topic),
          admin.fetchOffsets({ groupId, topics: [topic] }),
        ]);
        const highByPartition = new Map(topicOffsets.map((o) => [o.partition, Number(o.offset)]));
        const committed = groupOffsets[0]?.partitions ?? [];
        const lag = committed.reduce((sum, p) => {
          const high = highByPartition.get(p.partition) ?? 0;
          return sum + Math.max(0, high - Number(p.offset));
        }, 0);
        return { groupId, topic, lag };
      }),
    );
    return { ok: true, consumerLag };
  } finally {
    await admin.disconnect();
  }
}

async function getPostgresHealth(
  prisma: PrismaClient,
): Promise<{ ok: boolean; latencyMs: number | null }> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

// the event store itself knows how to check its own backend (ES cluster
// health vs. a Postgres round trip) — see storage/index.ts.
export async function getSystemHealth(
  kafka: Kafka,
  prisma: PrismaClient,
  eventStore: EventStore,
): Promise<SystemHealth> {
  const [kafka_, postgres, search] = await Promise.all([
    getConsumerLag(kafka).catch((): SystemHealth['kafka'] => ({ ok: false, consumerLag: [] })),
    getPostgresHealth(prisma),
    eventStore.checkHealth(),
  ]);

  return {
    kafka: kafka_,
    search: { backend: eventStore.backend, ok: search.ok, status: search.status },
    postgres,
  };
}
