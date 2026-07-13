import { describe, it, expect } from 'vitest';
import type { Alert, Incident } from '@argus/contracts';
import { templateProvider } from '../../src/ai/providers/template.js';

function incident(): Incident {
  return {
    incidentId: '00000000-0000-4000-8000-000000000001',
    correlationKey: '198.51.100.1',
    severity: 'high',
    status: 'open',
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-02T12:00:00.000Z',
    alertIds: ['a1', 'a2'],
    eventIds: ['e1', 'e2'],
  };
}

function alert(ruleId: string): Alert {
  return {
    alertId: `alert-${ruleId}`,
    ruleId,
    severity: 'high',
    timestamp: '2026-07-02T12:00:00.000Z',
    entity: '198.51.100.1',
    eventIds: ['e1'],
    message: `${ruleId} fired`,
  };
}

describe('templateProvider', () => {
  it('summarizes deterministically from the incident and its alerts', async () => {
    const draft = await templateProvider.summarize({
      incident: incident(),
      alerts: [alert('brute-force-ssh'), alert('sqli'), alert('brute-force-ssh')],
    });

    expect(draft.summary).toContain('198.51.100.1');
    expect(draft.summary).toContain('brute-force-ssh');
    expect(draft.summary).toContain('sqli');
    expect(draft.iocs).toEqual(['198.51.100.1']);
    expect(draft.recommendedActions.length).toBeGreaterThan(0);
  });
});

describe('templateProvider.translateQuery', () => {
  it('extracts a known rule id from a keyword', async () => {
    const filter = await templateProvider.translateQuery('show sqli incidents');
    expect(filter.ruleId).toBe('sqli-attempt');
  });

  it('extracts a rule id from a multi-word phrase', async () => {
    const filter = await templateProvider.translateQuery('any brute force attempts?');
    expect(filter.ruleId).toBe('brute-force-ssh');
  });

  it('extracts a severity word', async () => {
    const filter = await templateProvider.translateQuery('show critical incidents');
    expect(filter.severity).toBe('critical');
  });

  it('extracts a status word, including underscored status names', async () => {
    const filter = await templateProvider.translateQuery('show false positive incidents');
    expect(filter.status).toBe('false_positive');
  });

  it('parses "last N minute(s)/hour(s)/day(s)"', async () => {
    expect((await templateProvider.translateQuery('last 30 minutes')).sinceMinutes).toBe(30);
    expect((await templateProvider.translateQuery('last 2 hours')).sinceMinutes).toBe(120);
    expect((await templateProvider.translateQuery('last 1 day')).sinceMinutes).toBe(1440);
  });

  it('parses the "last hour" phrase without a leading number', async () => {
    expect(
      (await templateProvider.translateQuery('incidents from the last hour')).sinceMinutes,
    ).toBe(60);
  });

  it('combines multiple signals from one question', async () => {
    const filter = await templateProvider.translateQuery('show sqli incidents from the last hour');
    expect(filter.ruleId).toBe('sqli-attempt');
    expect(filter.sinceMinutes).toBe(60);
  });

  it('returns an empty filter when nothing is recognized', async () => {
    const filter = await templateProvider.translateQuery('what is going on');
    expect(filter).toEqual({});
  });
});
