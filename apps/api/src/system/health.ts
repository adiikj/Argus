import type { Kafka } from 'kafkajs';
import type { Client } from '@elastic/elasticsearch';
import type { PrismaClient } from '../incident/index.js';
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
  elasticsearch: { ok: boolean; status: string | null };
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

async function getEsHealth(esClient: Client): Promise<{ ok: boolean; status: string | null }> {
  try {
    const health = await esClient.cluster.health();
    return { ok: health.status !== 'red', status: health.status };
  } catch {
    return { ok: false, status: null };
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

export async function getSystemHealth(
  kafka: Kafka,
  esClient: Client,
  prisma: PrismaClient,
): Promise<SystemHealth> {
  const [kafka_, elasticsearch, postgres] = await Promise.all([
    getConsumerLag(kafka).catch((): SystemHealth['kafka'] => ({ ok: false, consumerLag: [] })),
    getEsHealth(esClient),
    getPostgresHealth(prisma),
  ]);
  return { kafka: kafka_, elasticsearch, postgres };
}
