// public interface of the streaming module — nothing else in apps/api should
// import from streaming/client.ts, streaming/admin.ts etc.
export { createKafkaClient } from './client.js';
export { ensureTopics } from './admin.js';
export { createProducer, type StreamProducer } from './producer.js';
export { subscribe, type MessageHandler } from './consumer.js';
export { TOPICS, type Topic } from './topics.js';
