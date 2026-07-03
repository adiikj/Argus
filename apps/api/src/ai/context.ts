import type { PrismaClient } from '../incident/index.js';
import { incidentRowToContract, alertRowToContract } from '../incident/index.js';
import type { SummaryInput } from './provider.js';

export async function loadIncidentContext(
  prisma: PrismaClient,
  incidentId: string,
): Promise<SummaryInput | undefined> {
  const row = await prisma.incident.findUnique({ where: { incidentId } });
  if (!row) return undefined;

  const alertRows = await prisma.alert.findMany({
    where: { incidentId },
    orderBy: { timestamp: 'asc' },
  });

  return { incident: incidentRowToContract(row), alerts: alertRows.map(alertRowToContract) };
}
