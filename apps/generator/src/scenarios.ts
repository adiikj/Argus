import type { RawLog } from '@argus/contracts';
import { apiGatewayLog, authLog, benignIp, nginxLog, pick, randInt } from './sources.js';

// The generator has two modes that share these builders (architecture §15):
//   - background noise: continuous low-rate *benign* traffic, so the dashboard
//     is never empty and reads as a live system.
//   - injectors: a scripted burst of *attack* traffic from one source, fired on
//     demand via POST /simulate/:scenario (or by the DEMO_MODE timeline).
// Detection rules live api-side; the generator just produces realistic traffic.

const BENIGN_USERS = ['jsmith', 'deploy', 'svc-backup', 'awong', 'mchen'] as const;
const BENIGN_PATHS = ['/', '/index.html', '/api/health', '/api/orders', '/assets/app.js'] as const;
const BENIGN_AGENTS = ['Mozilla/5.0', 'curl/8.4.0', 'Argus-Probe/1.0'] as const;

// one benign event, source chosen at random
export function benignEvent(): RawLog {
  const roll = randInt(3);
  const ip = benignIp();
  if (roll === 0) {
    // occasional benign auth failure (fat-fingered password) keeps noise honest
    const outcome = Math.random() < 0.15 ? 'failure' : 'success';
    return authLog({ user: pick(BENIGN_USERS), ip, outcome });
  }
  if (roll === 1) {
    return nginxLog({ ip, path: pick(BENIGN_PATHS), status: 200, userAgent: pick(BENIGN_AGENTS) });
  }
  return apiGatewayLog({
    ip,
    method: pick(['GET', 'POST']),
    path: pick(BENIGN_PATHS),
    status: 200,
    userAgent: pick(BENIGN_AGENTS),
    user: pick(BENIGN_USERS),
  });
}

export interface Scenario {
  name: string;
  description: string;
  generate: () => RawLog[];
}

// all attack traffic comes from a single attacker IP so it correlates cleanly
function attackerIp(): string {
  return `198.51.100.${1 + randInt(254)}`;
}

const SQLI_PAYLOADS = [
  "/products?id=1' OR '1'='1",
  "/products?id=1; DROP TABLE users--",
  "/search?q=%27%20UNION%20SELECT%20password%20FROM%20users--",
  "/login?user=admin'--",
] as const;

const ENUM_PATHS = [
  '/.env',
  '/.git/config',
  '/admin',
  '/wp-login.php',
  '/phpmyadmin',
  '/backup.zip',
  '/config.php',
  '/api/v1/internal',
] as const;

export const SCENARIOS: Record<string, Scenario> = {
  'brute-force': {
    name: 'brute-force',
    description: 'A burst of failed SSH logins from one IP (trips brute-force-ssh).',
    generate: () => {
      const ip = attackerIp();
      const user = pick(['root', 'admin', 'oracle']);
      const attempts = 8 + randInt(4);
      const logs = Array.from({ length: attempts }, () =>
        authLog({ user, ip, outcome: 'failure' }),
      );
      // a successful login right after the burst = the scary "they got in" case
      if (Math.random() < 0.5) logs.push(authLog({ user, ip, outcome: 'success' }));
      return logs;
    },
  },

  sqli: {
    name: 'sqli',
    description: 'SQL-injection probes against the API gateway (400/500s).',
    generate: () => {
      const ip = attackerIp();
      return SQLI_PAYLOADS.map((path) =>
        apiGatewayLog({ ip, method: 'GET', path, status: pick([400, 403, 500]), userAgent: 'sqlmap/1.8' }),
      );
    },
  },

  'dir-enum': {
    name: 'dir-enum',
    description: 'Directory / sensitive-file enumeration (a wall of 404s).',
    generate: () => {
      const ip = attackerIp();
      return ENUM_PATHS.map((path) =>
        nginxLog({ ip, path, status: pick([404, 403]), userAgent: 'gobuster/3.6' }),
      );
    },
  },

  'rate-abuse': {
    name: 'rate-abuse',
    description: 'High-rate hammering of one endpoint from a single IP.',
    generate: () => {
      const ip = attackerIp();
      const hits = 40 + randInt(20);
      return Array.from({ length: hits }, () =>
        apiGatewayLog({ ip, method: 'POST', path: '/api/login', status: pick([200, 429]), userAgent: 'python-requests/2.32' }),
      );
    },
  },

  'invalid-jwt': {
    name: 'invalid-jwt',
    description: 'A flood of requests bearing invalid/expired JWTs (401s).',
    generate: () => {
      const ip = attackerIp();
      const hits = 12 + randInt(8);
      return Array.from({ length: hits }, () =>
        apiGatewayLog({ ip, method: 'GET', path: '/api/account', status: 401, userAgent: 'okhttp/4.12' }),
      );
    },
  },
};

export const SCENARIO_NAMES = Object.keys(SCENARIOS);
