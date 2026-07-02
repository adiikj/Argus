import type { Kafka } from 'kafkajs';
import type { Topic } from './topics.js';

export type MessageHandler = (value: unknown, key: string | undefined) => Promise<void>;

// at-least-once: kafkajs commits offsets after eachMessage resolves (autoCommit
// default), so a handler that throws leaves the offset uncommitted and the
// message is redelivered on restart
export async function subscribe(
  kafka: Kafka,
  groupId: string,
  topic: Topic,
  onMessage: MessageHandler,
): Promise<void> {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value ? JSON.parse(message.value.toString()) : undefined;
      await onMessage(value, message.key?.toString());
    },
  });
}
