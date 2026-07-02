import type { Kafka, Producer } from 'kafkajs';
import type { Topic } from './topics.js';

export interface StreamProducer {
  send: (topic: Topic, key: string, value: unknown) => Promise<void>;
  disconnect: () => Promise<void>;
}

export async function createProducer(kafka: Kafka): Promise<StreamProducer> {
  const producer: Producer = kafka.producer();
  await producer.connect();

  return {
    send: async (topic, key, value) => {
      await producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(value) }],
      });
    },
    disconnect: () => producer.disconnect(),
  };
}
