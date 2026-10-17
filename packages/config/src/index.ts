import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// how many reverse-proxy hops sit in front of the api/generator (e.g. 1 for
// nginx/Caddy/cloudflared), or a comma list of proxy IPs/CIDRs. Decides which
// X-Forwarded-For entry becomes req.ip — the key every rate limiter uses.
// 'false' (default) = no proxy, use the socket address. 'true' is rejected on
// purpose: trusting every hop makes req.ip the *left-most* XFF entry, which the
// client writes itself — anyone could dodge the limiters by forging the header.
export const TrustProxy = z
  .string()
  .default('false')
  .transform((raw, ctx): false | number | string[] => {
    const value = raw.trim();
    if (value === '' || value === 'false' || value === '0') return false;
    if (value === 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "'true' trusts client-supplied X-Forwarded-For — use a hop count (e.g. 1) or proxy IPs/CIDRs",
      });
      return z.NEVER;
    }
    if (/^\d+$/.test(value)) return Number(value);
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  });

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
  // leave blank to use each provider's built-in default model
  GEMINI_MODEL: z.string().optional(),
  GROQ_MODEL: z.string().optional(),

  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // signs app JWTs for the per-user login system — always required. Enforcement
  // of the gate itself is dynamic at runtime (apps/api/src/auth), not this var:
  // the api runs fully open until the first account registers, then requires
  // a valid session on every route from then on.
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),

  // self-service sign-up (email form + first-time Google sign-in). 'true' for
  // local dev; set 'false' on any public deployment — the login gate is then
  // on from boot and accounts are created with the api's create-user CLI.
  ALLOW_REGISTRATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // optional: enables "Sign in with Google" alongside email+password; leave
  // blank to run email+password only (same optional-degradation as LLM_PROVIDER)
  GOOGLE_CLIENT_ID: z.string().optional(),

  // '*' for local dev; set to the real dashboard hostname once one exists (post-deploy)
  CORS_ORIGIN: z.string().default('*'),

  TRUST_PROXY: TrustProxy,

  // leave blank to keep the window store + bus in-process (single instance, no
  // extra infra); set it to back both with Redis (sorted sets / pub-sub) so
  // detection state and event fanout survive across more than one api process
  REDIS_URL: z.string().optional(),

  // optional: posts a Slack-compatible message on high/critical incidents,
  // same "runs with zero keys" degradation as the LLM/auth integrations
  SLACK_WEBHOOK_URL: z.string().optional(),
  // included as a clickable link in notifications if set; omitted otherwise
  DASHBOARD_URL: z.string().optional(),
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
