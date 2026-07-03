import { describe, it, expect } from 'vitest';
import type { Incident } from '@argus/contracts';
import { shouldResummarize, RESUMMARIZE_ALERT_DELTA } from '../../src/ai/resummarize.js';

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    incidentId: '00000000-0000-4000-8000-000000000001',
    correlationKey: '198.51.100.1',
    severity: 'high',
    status: 'open',
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-02T12:00:00.000Z',
    alertIds: ['a1'],
    eventIds: ['e1'],
    ...overrides,
  };
}

describe('shouldResummarize', () => {
  it('is true when there is no prior summary', () => {
    expect(shouldResummarize(undefined, incident())).toBe(true);
  });

  it('is true when severity escalates', () => {
    const prev = { severity: 'medium' as const, alertCount: 1 };
    expect(shouldResummarize(prev, incident({ severity: 'critical' }))).toBe(true);
  });

  it('is false when severity holds and the alert count barely moved', () => {
    const prev = { severity: 'high' as const, alertCount: 1 };
    const alertIds = Array.from({ length: RESUMMARIZE_ALERT_DELTA }, (_, i) => `a${i}`);
    expect(shouldResummarize(prev, incident({ alertIds }))).toBe(false);
  });

  it('is true once the alert count grows past the delta threshold', () => {
    const prev = { severity: 'high' as const, alertCount: 1 };
    const alertIds = Array.from({ length: RESUMMARIZE_ALERT_DELTA + 1 }, (_, i) => `a${i}`);
    expect(shouldResummarize(prev, incident({ alertIds }))).toBe(true);
  });
});
