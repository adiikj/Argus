import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import type { RuleContext } from '../../src/detection/rule.js';
import { passwordSprayingRule } from '../../src/detection/rules/password-spraying.js';
import { loginAfterBruteForceRule } from '../../src/detection/rules/login-after-brute-force.js';
import { scannerUserAgentRule } from '../../src/detection/rules/scanner-user-agent.js';
import { statefulRule } from './yaml-rules.js';

const bruteForceRule = statefulRule('brute-force-ssh');

let n = 0;
function auth(user: string, outcome: 'success' | 'failure', ip = '198.51.100.20'): NormalizedEvent {
  n += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    timestamp: '2026-10-17T12:00:00.000Z',
    source: 'auth',
    sourceIp: ip,
    outcome,
    username: user,
    raw: '',
  };
}

const ctx = (): RuleContext => ({
  window: new InMemoryWindowStore(),
  baseline: new InMemoryBaselineStore(),
});

describe('bruteForceRule (per account)', () => {
  it('does not combine failures across different accounts — that is spraying', async () => {
    const c = ctx();
    const results = [];
    for (const user of ['a', 'b', 'c', 'd', 'e', 'f']) {
      results.push(await bruteForceRule.evaluate(auth(user, 'failure'), c));
    }
    expect(results.every((r) => r === undefined)).toBe(true);
  });
});

describe('passwordSprayingRule', () => {
  it('fires once when the 5th distinct account fails, not on every failure after', async () => {
    const c = ctx();
    const fired = [];
    for (const user of ['admin', 'root', 'test', 'oracle', 'guest', 'ubuntu', 'admin']) {
      const alert = await passwordSprayingRule.evaluate(auth(user, 'failure'), c);
      if (alert) fired.push(alert);
    }
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ ruleId: 'password-spraying', severity: 'high', count: 5 });
    expect(fired[0]?.eventIds).toHaveLength(5);
  });

  it('ignores repeated failures against a single account', async () => {
    const c = ctx();
    for (let i = 0; i < 10; i += 1) {
      expect(await passwordSprayingRule.evaluate(auth('root', 'failure'), c)).toBeUndefined();
    }
  });

  it('keeps sources apart', async () => {
    const c = ctx();
    for (const [i, user] of ['a', 'b', 'c', 'd', 'e'].entries()) {
      const alert = await passwordSprayingRule.evaluate(
        auth(user, 'failure', `198.51.100.${i}`),
        c,
      );
      expect(alert).toBeUndefined();
    }
  });
});

describe('loginAfterBruteForceRule', () => {
  it('raises a critical alert when a brute-forced account logs in', async () => {
    const c = ctx();
    for (let i = 0; i < 6; i += 1)
      await loginAfterBruteForceRule.evaluate(auth('deploy', 'failure'), c);
    const alert = await loginAfterBruteForceRule.evaluate(auth('deploy', 'success'), c);
    expect(alert).toMatchObject({
      ruleId: 'login-after-brute-force',
      severity: 'critical',
      count: 6,
    });
    expect(alert?.eventIds).toHaveLength(7); // 6 failures + the success
    expect(alert?.message).toContain('6 failed attempts');
  });

  it('raises it after a spray too', async () => {
    const c = ctx();
    for (const user of ['a', 'b', 'c', 'd', 'e']) {
      await loginAfterBruteForceRule.evaluate(auth(user, 'failure'), c);
    }
    const alert = await loginAfterBruteForceRule.evaluate(auth('svc', 'success'), c);
    expect(alert?.message).toContain('5 different accounts');
  });

  it('stays quiet for a normal login after a typo or two', async () => {
    const c = ctx();
    await loginAfterBruteForceRule.evaluate(auth('jsmith', 'failure'), c);
    await loginAfterBruteForceRule.evaluate(auth('jsmith', 'failure'), c);
    expect(await loginAfterBruteForceRule.evaluate(auth('jsmith', 'success'), c)).toBeUndefined();
  });
});

describe('scannerUserAgentRule', () => {
  const req = (userAgent: string, ip = '198.51.100.30'): NormalizedEvent => ({
    ...auth('x', 'failure', ip),
    source: 'nginx',
    userAgent,
  });

  it('fires once per tool per source, not per request', async () => {
    const c = ctx();
    const first = await scannerUserAgentRule.evaluate(req('sqlmap/1.8#stable'), c);
    const second = await scannerUserAgentRule.evaluate(req('sqlmap/1.8#stable'), c);
    const otherTool = await scannerUserAgentRule.evaluate(req('Nuclei - Open-source project'), c);
    expect(first).toMatchObject({ ruleId: 'scanner-user-agent', severity: 'low' });
    expect(first?.message).toContain('sqlmap');
    expect(second).toBeUndefined();
    expect(otherTool?.message).toContain('nuclei');
  });

  it.each(['Mozilla/5.0', 'curl/8.4.0', 'python-requests/2.32', 'Go-http-client/1.1'])(
    'leaves generic client %s alone',
    async (ua) => expect(await scannerUserAgentRule.evaluate(req(ua), ctx())).toBeUndefined(),
  );
});
