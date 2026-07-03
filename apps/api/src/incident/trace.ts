import type { PrismaClient } from '../../generated/prisma/index.js';
import type { Alert, Incident } from '@argus/contracts';
import { alertRowToContract, incidentRowToContract } from './mappers.js';

export interface EventAlertTrace {
  alerts: Alert[];
  incidents: Incident[];
}

export async function getAlertsAndIncidentsForEvent(
  prisma: PrismaClient,
  eventId: string,
): Promise<EventAlertTrace> {
  const alertRows = await prisma.alert.findMany({
    where: { eventIds: { has: eventId } },
    orderBy: { timestamp: 'asc' },
  });

  const incidentIds = [...new Set(alertRows.map((row) => row.incidentId))];
  const incidentRows = incidentIds.length
    ? await prisma.incident.findMany({ where: { incidentId: { in: incidentIds } } })
    : [];

  return {
    alerts: alertRows.map(alertRowToContract),
    incidents: incidentRows.map(incidentRowToContract),
  };
}
