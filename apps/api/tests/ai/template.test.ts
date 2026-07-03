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
