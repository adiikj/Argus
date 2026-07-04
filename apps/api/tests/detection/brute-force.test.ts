import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { bruteForceRule, RULE_ID } from '../../src/detection/rules/brute-force.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import type { RuleContext } from '../../src/detection/rule.js';

let counter = 0;
function failure(sourceIp: string): NormalizedEvent {
  counter += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'auth',
    sourceIp,
    outcome: 'failure',
    raw: 'Failed password ...',
  };
}

function ctx(): RuleContext {
  return { window: new InMemoryWindowStore(), baseline: new InMemoryBaselineStore() };
}

describe('bruteForceRule', () => {
  it('stays quiet below the threshold', async () => {
    const c = ctx();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => bruteForceRule.evaluate(failure('198.51.100.1'), c)),
    );
    expect(results.every((r) => r === undefined)).toBe(true);
  });

  it('fires once the failed-login threshold is crossed', async () => {
    const c = ctx();
    let alert;
    for (let i = 0; i < 5; i += 1)
      alert = await bruteForceRule.evaluate(failure('198.51.100.2'), c);
    expect(alert).toMatchObject({ ruleId: RULE_ID, severity: 'high', entity: '198.51.100.2' });
    expect(alert?.count).toBe(5);
    expect(alert?.eventIds).toHaveLength(5);
  });

  it('keys the window per source IP (two IPs do not combine)', async () => {
    const c = ctx();
    for (let i = 0; i < 4; i += 1) await bruteForceRule.evaluate(failure('198.51.100.3'), c);
    const other = await bruteForceRule.evaluate(failure('198.51.100.4'), c);
    expect(other).toBeUndefined();
  });

  it('ignores successful logins and non-auth events', async () => {
    const c = ctx();
    const success: NormalizedEvent = { ...failure('198.51.100.5'), outcome: 'success' };
    const nginx: NormalizedEvent = { ...failure('198.51.100.5'), source: 'nginx' };
    expect(await bruteForceRule.evaluate(success, c)).toBeUndefined();
    expect(await bruteForceRule.evaluate(nginx, c)).toBeUndefined();
  });
});
