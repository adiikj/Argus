import { randomUUID } from 'node:crypto';
import { SEVERITY_RANK, type Alert, type Incident } from '@argus/contracts';

// how long an incident stays open to attract more alerts from the same
// entity. Generous on purpose: the generator's five scenarios all fire from
// one attacker IP (§15) so a demo run should land in *one* incident, not five.
export const CORRELATION_WINDOW_MS = 15 * 60_000;

export interface CorrelationResult {
  incident: Incident;
  isNew: boolean;
}

// pure decision: given the entity's currently-open incident (already
// filtered by the caller to be within the correlation window, or undefined
// if none), fold in the new alert. No I/O — attach.ts persists the result.
export function correlate(
  existing: Incident | undefined,
  alert: Alert,
  now: number = Date.now(),
): CorrelationResult {
  const nowIso = new Date(now).toISOString();

  if (!existing) {
    return {
      isNew: true,
      incident: {
        incidentId: randomUUID(),
        correlationKey: alert.entity,
        severity: alert.severity,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
        alertIds: [alert.alertId],
        eventIds: [...alert.eventIds],
        assigneeId: null,
        resolutionNote: null,
      },
    };
  }

  return {
    isNew: false,
    incident: {
      ...existing,
      severity: maxSeverity(existing.severity, alert.severity),
      updatedAt: nowIso,
      alertIds: [...existing.alertIds, alert.alertId],
      eventIds: [...existing.eventIds, ...alert.eventIds],
    },
  };
}

function maxSeverity(a: Incident['severity'], b: Alert['severity']): Incident['severity'] {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
