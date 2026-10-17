import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// which peers are trusted reverse proxies — a comma list of IPs/CIDRs or
// proxy-addr's named ranges (loopback, linklocal, uniquelocal). Decides which
// X-Forwarded-For entry becomes req.ip — the key every rate limiter uses:
// Fastify walks XFF from the right and stops at the first untrusted address.
// Behind nginx/Caddy/cloudflared in Docker: 'loopback,uniquelocal' (the
// private ranges Docker networks live in). 'false' (default) = no proxy.
//
// Rejected on purpose:
//   - 'true': trusts every hop, so req.ip becomes the *left-most* XFF entry,
//     which the client writes itself — anyone could pick their own IP.
//   - a hop count ('1'): can't verify the immediate peer is actually the
//     proxy, so a client reaching the port directly could forge XFF. Fastify
//     >=5.12 fails closed on it (trusts nothing), which would silently put
//     every visitor back in one shared rate-limit bucket.
export const TrustProxy = z
  .string()
  .default('false')
  .transform((raw, ctx): false | string[] => {
    const value = raw.trim();
    if (value === '' || value === 'false') return false;
    if (value === 'true' || /^\d+$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `TRUST_PROXY='${value}' is not allowed — list the proxy's addresses instead, e.g. 'loopback,uniquelocal' or '172.18.0.0/16'`,
      });
      return z.NEVER;
    }
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
  // normalized events older than this are pruned hourly (0 = keep forever).
  // Alerts/incidents/summaries are never pruned.
  EVENT_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(7),
  // path to DB-IP's IP-to-Country Lite .mmdb (the api image ships one); unset
  // = real IPs get no map location, simulated demo IPs still do
  GEOIP_DB: z.string().optional(),

  LLM_PROVIDER: z.enum(['none', 'gemini', 'groq']).default('none'),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  // leave blank to use each provider's built-in default model
  GEMINI_MODEL: z.string().optional(),
  GROQ_MODEL: z.string().optional(),

  // generator background-noise cadence: one benign event per interval. ~1.2s
  // reads as a busy live system locally; 3–5s keeps a small VM's disk + CPU calm.
  NOISE_INTERVAL_MS: z.coerce.number().int().min(100).default(1200),

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

  // '*' for local dev; on a deployment, the dashboard origin(s) as a comma list,
  // e.g. https://argus.vercel.app,https://argus.example.com
  CORS_ORIGIN: z
    .string()
    .default('*')
    .transform((s) =>
      s
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),

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
