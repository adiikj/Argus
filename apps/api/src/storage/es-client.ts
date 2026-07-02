import { Client } from '@elastic/elasticsearch';
import type { AppConfig } from '@argus/config';

export function createEsClient(config: AppConfig): Client {
  return new Client({ node: config.ES_NODE });
}
