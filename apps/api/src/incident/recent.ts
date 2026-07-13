import type { RecentActivity } from '@argus/contracts';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { incidentRowToContract, alertRowToContract } from './mappers.js';

// backs GET /incidents — a snapshot of recent activity so a freshly opened
// dashboard tab has something to show instead of waiting on live WS traffic
// (apps/dashboard's RealtimeProvider otherwise only accumulates from here on).
export async function getRecentActivity(prisma: PrismaClient): Promise<RecentActivity> {
  const rows = await prisma.incident.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { alerts: { orderBy: { timestamp: 'desc' }, take: 1 } },
  });

  const incidents = rows
    .filter((row) => row.alerts[0])
    .map((row) => ({
      incident: incidentRowToContract(row),
      latestAlert: alertRowToContract(row.alerts[0]!),
    }));

  const grouped = await prisma.alert.groupBy({ by: ['ruleId'], _count: { ruleId: true } });
  const ruleCounts = Object.fromEntries(grouped.map((g) => [g.ruleId, g._count.ruleId]));

  const hourlyActivity = Array.from({ length: 24 }, () => 0);
  const timestamps = await prisma.alert.findMany({ select: { timestamp: true } });
  for (const { timestamp } of timestamps) {
    const hour = timestamp.getHours();
    hourlyActivity[hour] = (hourlyActivity[hour] ?? 0) + 1;
  }

  return { incidents, ruleCounts, hourlyActivity };
}
