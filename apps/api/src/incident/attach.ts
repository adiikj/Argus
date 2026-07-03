import type { PrismaClient, Incident as IncidentRow } from '../../generated/prisma/index.js';
import type { Alert, Incident } from '@argus/contracts';
import { correlate, CORRELATION_WINDOW_MS, type CorrelationResult } from './correlate.js';

function fromRow(row: IncidentRow): Incident {
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

// alerts -> incidents (§7): within one transaction, attach the alert to the
// matching open incident (same entity, updated within the correlation
// window) or open a new one, then insert the alert row referencing it. The
// incident write and the alert write commit together — no partial state.
export async function attachAlert(prisma: PrismaClient, alert: Alert): Promise<CorrelationResult> {
  return prisma.$transaction(async (tx) => {
    const openRow = await tx.incident.findFirst({
      where: {
        correlationKey: alert.entity,
        status: 'open',
        updatedAt: { gte: new Date(Date.now() - CORRELATION_WINDOW_MS) },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const { incident, isNew } = correlate(openRow ? fromRow(openRow) : undefined, alert);

    if (isNew) {
      await tx.incident.create({
        data: {
          incidentId: incident.incidentId,
          correlationKey: incident.correlationKey,
          severity: incident.severity,
          status: incident.status,
          createdAt: new Date(incident.createdAt),
          updatedAt: new Date(incident.updatedAt),
          alertIds: incident.alertIds,
          eventIds: incident.eventIds,
        },
      });
    } else {
      await tx.incident.update({
        where: { incidentId: incident.incidentId },
        data: {
          severity: incident.severity,
          updatedAt: new Date(incident.updatedAt),
          alertIds: incident.alertIds,
          eventIds: incident.eventIds,
        },
      });
    }

    await tx.alert.create({
      data: {
        alertId: alert.alertId,
        ruleId: alert.ruleId,
        severity: alert.severity,
        timestamp: new Date(alert.timestamp),
        entity: alert.entity,
        eventIds: alert.eventIds,
        message: alert.message,
        count: alert.count,
        incidentId: incident.incidentId,
      },
    });

    return { incident, isNew } satisfies CorrelationResult;
  });
}
