import { describe, it, expect } from 'vitest';
import type { Alert } from '@argus/contracts';
import { correlate } from '../../src/incident/correlate.js';

let counter = 0;
function alert(overrides: Partial<Alert> = {}): Alert {
  counter += 1;
  return {
    alertId: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    ruleId: 'brute-force-ssh',
    severity: 'high',
    timestamp: '2026-07-02T12:00:00.000Z',
    entity: '198.51.100.1',
    eventIds: [`11111111-0000-4000-8000-${String(counter).padStart(12, '0')}`],
    message: 'test alert',
    ...overrides,
  };
}

describe('correlate', () => {
  it('opens a new incident when there is no existing one', () => {
    const a = alert();
    const { incident, isNew } = correlate(undefined, a);

    expect(isNew).toBe(true);
    expect(incident.correlationKey).toBe(a.entity);
    expect(incident.severity).toBe(a.severity);
    expect(incident.status).toBe('open');
    expect(incident.alertIds).toEqual([a.alertId]);
    expect(incident.eventIds).toEqual(a.eventIds);
  });

  it('attaches a new alert to the existing incident, merging ids', () => {
    const first = alert();
    const { incident: opened } = correlate(undefined, first);

    const second = alert({ eventIds: ['22222222-0000-4000-8000-000000000001'] });
    const { incident, isNew } = correlate(opened, second);

    expect(isNew).toBe(false);
    expect(incident.incidentId).toBe(opened.incidentId);
    expect(incident.alertIds).toEqual([first.alertId, second.alertId]);
    expect(incident.eventIds).toEqual([...first.eventIds, ...second.eventIds]);
  });

  it('escalates severity to the max of existing and incoming', () => {
    const { incident: opened } = correlate(undefined, alert({ severity: 'medium' }));
    const { incident } = correlate(opened, alert({ severity: 'critical' }));
    expect(incident.severity).toBe('critical');
  });

  it('does not downgrade severity when a lower-severity alert attaches', () => {
    const { incident: opened } = correlate(undefined, alert({ severity: 'high' }));
    const { incident } = correlate(opened, alert({ severity: 'low' }));
    expect(incident.severity).toBe('high');
  });

  it('bumps updatedAt but keeps createdAt/incidentId stable across attaches', () => {
    const { incident: opened } = correlate(undefined, alert(), 0);
    const { incident } = correlate(opened, alert(), 60_000);

    expect(incident.incidentId).toBe(opened.incidentId);
    expect(incident.createdAt).toBe(opened.createdAt);
    expect(incident.updatedAt).not.toBe(opened.updatedAt);
  });
});
