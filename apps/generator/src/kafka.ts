import { Kafka, logLevel } from 'kafkajs';
import type { AppConfig } from '@argus/config';

const RAW_LOGS_TOPIC = 'raw.logs';

export interface RawLogProducer {
  send: (key: string, value: unknown) => Promise<void>;
  disconnect: () => Promise<void>;
}

// the generator is a separate app  — it owns its own tiny
// Kafka wiring rather than reaching into apps/api/src/streaming.
export async function createRawLogProducer(config: AppConfig): Promise<RawLogProducer> {
  const kafka = new Kafka({
    clientId: 'argus-generator',
    brokers: config.KAFKA_BROKERS,
    logLevel: logLevel.WARN,
  });

  // KAFKA_AUTO_CREATE_TOPICS_ENABLE=false, so whichever app starts first creates it.
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [{ topic: RAW_LOGS_TOPIC, numPartitions: 1, replicationFactor: 1 }],
    });
  } finally {
    await admin.disconnect();
  }

  const producer = kafka.producer();
  await producer.connect();

  return {
    send: async (key, value) => {
      await producer.send({
        topic: RAW_LOGS_TOPIC,
        messages: [{ key, value: JSON.stringify(value) }],
      });
    },
    disconnect: () => producer.disconnect(),
  };
}
