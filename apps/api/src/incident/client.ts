import { PrismaClient } from '../../generated/prisma/index.js';
import type { AppConfig } from '@argus/config';

export function createPrismaClient(config: AppConfig): PrismaClient {
  return new PrismaClient({ datasourceUrl: config.POSTGRES_URL });
}
