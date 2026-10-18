import { describe, expect, it, vi } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { createRuleEngine } from '../../src/detection/engine.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import { loginAfterBruteForceRule } from '../../src/detection/rules/login-after-brute-force.js';
import { statefulRule, statelessRule } from './yaml-rules.js';

const bruteForceRule = statefulRule('brute-force-ssh');
const rateAbuseRule = statefulRule('api-rate-abuse');
const sqliRule = statelessRule('sqli-attempt');

let n = 0;
function event(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  n += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    timestamp: '2026-10-17T12:00:00.000Z',
    source: 'api-gateway',
    sourceIp: '198.51.100.50',
    outcome: 'success',
    raw: 'x',
    ...overrides,
  };
}

describe('rule engine state isolation', () => {
  // regression: both rules key their window by source IP and used to share
  // one — 40 API calls + 1 failed SSH login read as "41 failed SSH logins"
  it("doesn't let one rule's window entries leak into another's", async () => {
    const engine = createRuleEngine(
      [bruteForceRule, rateAbuseRule],
      new InMemoryWindowStore(),
      new InMemoryBaselineStore(),
    );
    for (let i = 0; i < 40; i += 1) await engine.evaluate(event({ path: '/api/login' }));

    const alerts = await engine.evaluate(
      event({ source: 'auth', outcome: 'failure', username: 'root' }),
    );
    expect(alerts.map((a) => a.ruleId)).not.toContain('brute-force-ssh');
  });
});

describe('alert throttling', () => {
  const sqli = (ip = '198.51.100.60') =>
    event({ source: 'nginx', sourceIp: ip, path: "/p?id=1' OR '1'='1" });

  it('fires once per rule+source per window, then says what it suppressed', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
      let suppressed = 0;
      const engine = createRuleEngine(
        [sqliRule],
        new InMemoryWindowStore(),
        new InMemoryBaselineStore(),
        { throttleMs: 60_000, onSuppressed: () => (suppressed += 1) },
      );

      const first = [];
      for (let i = 0; i < 10; i += 1) first.push(...(await engine.evaluate(sqli())));
      expect(first).toHaveLength(1);
      expect(suppressed).toBe(9);

      // a different source is its own throttle
      expect(await engine.evaluate(sqli('198.51.100.61'))).toHaveLength(1);

      vi.setSystemTime(new Date('2026-10-17T12:01:01Z')); // window over
      const [next] = await engine.evaluate(sqli());
      expect(next?.message).toContain('+9 similar suppressed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never throttles critical alerts', async () => {
    const engine = createRuleEngine(
      [loginAfterBruteForceRule],
      new InMemoryWindowStore(),
      new InMemoryBaselineStore(),
    );
    const login = (outcome: 'success' | 'failure') =>
      event({ source: 'auth', outcome, username: 'deploy', sourceIp: '198.51.100.62' });
    for (let i = 0; i < 6; i += 1) await engine.evaluate(login('failure'));
    expect(await engine.evaluate(login('success'))).toHaveLength(1);
    expect(await engine.evaluate(login('success'))).toHaveLength(1);
  });

  it('can be switched off', async () => {
    const engine = createRuleEngine(
      [sqliRule],
      new InMemoryWindowStore(),
      new InMemoryBaselineStore(),
      {
        throttleMs: 0,
      },
    );
    for (let i = 0; i < 3; i += 1) expect(await engine.evaluate(sqli())).toHaveLength(1);
  });
});

describe('first evidence (MTTD)', () => {
  it('stamps a single-event alert with the event time', async () => {
    const engine = createRuleEngine(
      [sqliRule],
      new InMemoryWindowStore(),
      new InMemoryBaselineStore(),
    );
    const [alert] = await engine.evaluate(
      event({ path: "/q?id=1' OR '1'='1", timestamp: '2026-10-17T11:59:58.000Z' }),
    );
    expect(alert?.firstSeenAt).toBe('2026-10-17T11:59:58.000Z');
  });

  it('stamps a windowed alert with when its window started filling', async () => {
    const engine = createRuleEngine(
      [bruteForceRule],
      new InMemoryWindowStore(),
      new InMemoryBaselineStore(),
    );
    const start = Date.now();
    let alerts: Awaited<ReturnType<typeof engine.evaluate>> = [];
    for (let i = 0; i < 5; i += 1) {
      alerts = await engine.evaluate(
        event({ source: 'auth', outcome: 'failure', username: 'root' }),
      );
    }
    const firstSeen = Date.parse(alerts[0]!.firstSeenAt!);
    expect(firstSeen).toBeGreaterThanOrEqual(start);
    expect(firstSeen).toBeLessThanOrEqual(Date.parse(alerts[0]!.timestamp));
  });
});
