import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { anomalyRule, RULE_ID } from '../../src/detection/rules/anomaly.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import type { RuleContext } from '../../src/detection/rule.js';

function ctx(): RuleContext {
  return { window: new InMemoryWindowStore(), baseline: new InMemoryBaselineStore() };
}

let n = 0;
function nginxEvent(sourceIp: string): NormalizedEvent {
  n += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'nginx',
    sourceIp,
    outcome: 'success',
    path: '/',
    statusCode: 200,
    raw: '',
  };
}

describe('anomalyRule', () => {
  it('stays quiet below the minimum-count floor even for a brand-new IP', async () => {
    const c = ctx();
    let alert;
    for (let i = 0; i < 5; i += 1)
      alert = await anomalyRule.evaluate(nginxEvent('198.51.100.20'), c);
    expect(alert).toBeUndefined();
  });

  it('fires once a fresh entity crosses the count floor (baseline is implicitly zero)', async () => {
    const c = ctx();
    let alert;
    for (let i = 0; i < 8; i += 1)
      alert = await anomalyRule.evaluate(nginxEvent('198.51.100.21'), c);
    expect(alert).toMatchObject({ ruleId: RULE_ID, severity: 'medium', entity: '198.51.100.21' });
    expect(alert?.count).toBe(8);
  });

  it('ignores non-nginx events', async () => {
    const c = ctx();
    let alert;
    for (let i = 0; i < 10; i += 1) {
      const event: NormalizedEvent = { ...nginxEvent('198.51.100.22'), source: 'api-gateway' };
      alert = await anomalyRule.evaluate(event, c);
    }
    expect(alert).toBeUndefined();
  });

  it('keeps baselines independent per source IP', async () => {
    const c = ctx();
    for (let i = 0; i < 8; i += 1) await anomalyRule.evaluate(nginxEvent('198.51.100.23'), c);
    const other = await anomalyRule.evaluate(nginxEvent('198.51.100.24'), c);
    expect(other).toBeUndefined();
  });
});
