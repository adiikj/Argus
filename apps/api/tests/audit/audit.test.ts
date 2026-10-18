import { describe, expect, it } from 'vitest';
import { diffIncident } from '../../src/incident/index.js';
import { redactActors } from '../../src/audit/index.js';

const existing = {
  incidentId: 'i1',
  status: 'open' as const,
  assigneeId: null,
  resolutionNote: null,
};

describe('diffIncident', () => {
  it('records one change per field that actually changed', () => {
    expect(
      diffIncident(existing, {
        status: 'resolved',
        assigneeId: 'u1',
        resolutionNote: 'blocked at the edge',
      }),
    ).toEqual([
      {
        targetType: 'incident',
        targetId: 'i1',
        action: 'incident.status',
        from: 'open',
        to: 'resolved',
      },
      { targetType: 'incident', targetId: 'i1', action: 'incident.assignee', from: null, to: 'u1' },
      {
        targetType: 'incident',
        targetId: 'i1',
        action: 'incident.note',
        from: null,
        to: 'blocked at the edge',
      },
    ]);
  });

  it('leaves no trace for a no-op patch', () => {
    expect(diffIncident(existing, { status: 'open', assigneeId: null })).toEqual([]);
    expect(diffIncident(existing, {})).toEqual([]);
  });

  it('records an unassignment', () => {
    expect(diffIncident({ ...existing, assigneeId: 'u1' }, { assigneeId: null })).toMatchObject([
      { action: 'incident.assignee', from: 'u1', to: null },
    ]);
  });
});

describe('redactActors', () => {
  it('drops emails but keeps roles', () => {
    const [entry] = redactActors([
      {
        id: '00000000-0000-4000-8000-000000000001',
        at: '2026-10-18T09:00:00.000Z',
        actor: { userId: 'a', email: 'a@example.com', role: 'analyst' },
        action: 'incident.status',
        targetType: 'incident',
        targetId: 'i1',
        from: 'open',
        to: 'acknowledged',
      },
    ]);
    expect(entry?.actor).toEqual({ userId: 'a', email: null, role: 'analyst' });
  });
});
