import type { Incident, IncidentQuery } from '@argus/contracts';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { incidentRowToContract } from './mappers.js';

// `alerts: { some: { ruleId } }` uses the real Prisma relation both models
// already declare — no manual join needed.
export async function searchIncidents(
  prisma: PrismaClient,
  filter: IncidentQuery,
): Promise<Incident[]> {
  const rows = await prisma.incident.findMany({
    where: {
      ...(filter.ruleId && { alerts: { some: { ruleId: filter.ruleId } } }),
      ...(filter.severity && { severity: filter.severity }),
      ...(filter.status && { status: filter.status }),
      ...(filter.sinceMinutes && {
        createdAt: { gte: new Date(Date.now() - filter.sinceMinutes * 60_000) },
      }),
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return rows.map(incidentRowToContract);
}
