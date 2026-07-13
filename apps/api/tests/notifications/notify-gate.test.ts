import { describe, it, expect } from 'vitest';
import type { Incident } from '@argus/contracts';
import { shouldNotify } from '../../src/notifications/notify-gate.js';

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
    assigneeId: null,
    resolutionNote: null,
    ...overrides,
  };
}

describe('shouldNotify', () => {
  it('is true the first time a high-severity incident is seen', () => {
    expect(shouldNotify(undefined, incident({ severity: 'high' }))).toBe(true);
  });

  it('is true the first time a critical-severity incident is seen', () => {
    expect(shouldNotify(undefined, incident({ severity: 'critical' }))).toBe(true);
  });

  it('is false for medium/low/info severity, even with no prior state', () => {
    expect(shouldNotify(undefined, incident({ severity: 'medium' }))).toBe(false);
    expect(shouldNotify(undefined, incident({ severity: 'low' }))).toBe(false);
    expect(shouldNotify(undefined, incident({ severity: 'info' }))).toBe(false);
  });

  it('is false once already notified, regardless of further updates', () => {
    const prev = { notifiedAt: Date.now() };
    expect(shouldNotify(prev, incident({ severity: 'critical' }))).toBe(false);
  });
});
