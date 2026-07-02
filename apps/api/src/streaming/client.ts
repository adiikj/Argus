import { Kafka, logLevel } from 'kafkajs';
import type { AppConfig } from '@argus/config';

export function createKafkaClient(config: AppConfig): Kafka {
  return new Kafka({
    clientId: 'argus-api',
    brokers: config.KAFKA_BROKERS,
    logLevel: logLevel.WARN, // kafkajs is chatty at INFO; pino owns our logs
  });
}
