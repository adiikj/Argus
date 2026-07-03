import type { Incident as IncidentRow, Alert as AlertRow } from '../../generated/prisma/index.js';
import type { Incident, Alert } from '@argus/contracts';

export function incidentRowToContract(row: IncidentRow): Incident {
  return {
    incidentId: row.incidentId,
    correlationKey: row.correlationKey,
    severity: row.severity,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    alertIds: row.alertIds,
    eventIds: row.eventIds,
  };
}

export function alertRowToContract(row: AlertRow): Alert {
  return {
    alertId: row.alertId,
    ruleId: row.ruleId,
    severity: row.severity,
    timestamp: row.timestamp.toISOString(),
    entity: row.entity,
    eventIds: row.eventIds,
    message: row.message,
    count: row.count ?? undefined,
  };
}
