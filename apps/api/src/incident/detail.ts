import type { PrismaClient } from '../../generated/prisma/index.js';
import type { Alert, Incident, IncidentSummary } from '@argus/contracts';
import { incidentRowToContract, alertRowToContract, summaryRowToContract } from './mappers.js';

export interface IncidentWithAlerts {
  incident: Incident;
  alerts: Alert[];
}

export async function loadIncidentWithAlerts(
  prisma: PrismaClient,
  incidentId: string,
): Promise<IncidentWithAlerts | undefined> {
  const row = await prisma.incident.findUnique({ where: { incidentId } });
  if (!row) return undefined;

  const alertRows = await prisma.alert.findMany({
    where: { incidentId },
    orderBy: { timestamp: 'asc' },
  });

  return { incident: incidentRowToContract(row), alerts: alertRows.map(alertRowToContract) };
}

export interface IncidentDetail extends IncidentWithAlerts {
  summary: IncidentSummary | undefined;
}

export async function getIncidentDetail(
  prisma: PrismaClient,
  incidentId: string,
): Promise<IncidentDetail | undefined> {
  const base = await loadIncidentWithAlerts(prisma, incidentId);
  if (!base) return undefined;

  const summaryRow = await prisma.summary.findUnique({ where: { incidentId } });
  return { ...base, summary: summaryRow ? summaryRowToContract(summaryRow) : undefined };
}
