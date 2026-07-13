import type {
  Incident as IncidentRow,
  Alert as AlertRow,
  Summary as SummaryRow,
} from '../../generated/prisma/index.js';
import type { Incident, Alert, IncidentSummary } from '@argus/contracts';

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
    assigneeId: row.assigneeId,
    resolutionNote: row.resolutionNote,
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

export function summaryRowToContract(row: SummaryRow): IncidentSummary {
  return {
    incidentId: row.incidentId,
    summary: row.summary,
    iocs: row.iocs,
    recommendedActions: row.recommendedActions,
    generatedBy: row.generatedBy,
    generatedAt: row.generatedAt.toISOString(),
  };
}
