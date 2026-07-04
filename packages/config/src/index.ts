import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(4000),
  // generator runs its own HTTP surface (the /simulate trigger API, §15)
  GENERATOR_PORT: z.coerce.number().int().positive().default(4200),

  KAFKA_BROKERS: z
    .string()
    .default('localhost:9092')
    .transform((s) =>
      s
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
    ),

  POSTGRES_URL: z.string().default('postgresql://argus:argus@localhost:5432/argus'),
  ES_NODE: z.string().default('http://localhost:9200'),
  STORAGE_PROFILE: z.enum(['full', 'lite']).default('full'),

  LLM_PROVIDER: z.enum(['none', 'gemini', 'groq']).default('none'),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // single shared site password, not user accounts — leave blank to run with no gate
  // (same "runs with zero keys" degradation as the LLM providers)
  SITE_PASSWORD: z.string().optional(),
  AUTH_SECRET: z.string().optional(),

  // '*' for local dev; set to the real dashboard hostname once one exists (post-deploy)
  CORS_ORIGIN: z.string().default('*'),

  // leave blank to keep the window store + bus in-process (single instance, no
  // extra infra); set it to back both with Redis (sorted sets / pub-sub) so
  // detection state and event fanout survive across more than one api process
  REDIS_URL: z.string().optional(),
});

export type AppConfig = z.infer<typeof EnvSchema>;

// walk up to the repo root .env (we run from package dirs)
function findEnvFile(start: string = process.cwd()): string | undefined {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

let cached: AppConfig | undefined;

// fail loud at boot rather than at runtime
export function loadConfig(): AppConfig {
  if (cached) return cached;

  const envFile = findEnvFile();
  if (envFile) loadDotenv({ path: envFile });

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
