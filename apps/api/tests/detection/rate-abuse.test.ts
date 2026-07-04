import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { rateAbuseRule, RULE_ID } from '../../src/detection/rules/rate-abuse.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import type { RuleContext } from '../../src/detection/rule.js';

// Day 6 spec — remove `.skip` once implemented (§19). Proposed: fire when
// requests-per-IP in the window exceed the threshold (default 30), severity
// 'medium', entity = sourceIp, count = window size.
function ctx(): RuleContext {
  return { window: new InMemoryWindowStore(), baseline: new InMemoryBaselineStore() };
}

let n = 0;
function gwEvent(): NormalizedEvent {
  n += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'api-gateway',
    sourceIp: '198.51.100.9',
    outcome: 'success',
    path: '/api/login',
    statusCode: 200,
    raw: '',
  };
}

describe('rateAbuseRule', () => {
  it('stays quiet well below the threshold', async () => {
    const c = ctx();
    let alert;
    for (let i = 0; i < 10; i += 1) alert = await rateAbuseRule.evaluate(gwEvent(), c);
    expect(alert).toBeUndefined();
  });

  it('fires once the request rate is exceeded', async () => {
    const c = ctx();
    let alert;
    for (let i = 0; i < 35; i += 1) alert = await rateAbuseRule.evaluate(gwEvent(), c);
    expect(alert).toMatchObject({ ruleId: RULE_ID, severity: 'medium', entity: '198.51.100.9' });
    expect(alert?.count).toBeGreaterThanOrEqual(31);
  });

  it('ignores non-gateway events', async () => {
    const c = ctx();
    const nginx: NormalizedEvent = { ...gwEvent(), source: 'nginx' };
    expect(await rateAbuseRule.evaluate(nginx, c)).toBeUndefined();
  });
});
