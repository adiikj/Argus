import type { Incident, IncidentPatch, IncidentStatus } from '@argus/contracts';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { canTransition } from './transitions.js';
import { incidentRowToContract } from './mappers.js';
import { recordAudit, type Actor, type AuditChange } from '../audit/index.js';

export type PatchIncidentError =
  'not_found' | 'invalid_transition' | 'resolution_note_required' | 'assignee_not_found';

export type PatchIncidentResult =
  { ok: true; incident: Incident } | { ok: false; error: PatchIncidentError };

const TERMINAL_STATUSES = new Set(['resolved', 'false_positive']);

// one audit row per field the patch actually changes; a no-op patch (same
// status, same assignee) leaves no trace
export function diffIncident(
  existing: {
    incidentId: string;
    status: IncidentStatus;
    assigneeId: string | null;
    resolutionNote: string | null;
  },
  input: IncidentPatch,
): AuditChange[] {
  const target = { targetType: 'incident' as const, targetId: existing.incidentId };
  const changes: AuditChange[] = [];
  if (input.status !== undefined && input.status !== existing.status) {
    changes.push({ ...target, action: 'incident.status', from: existing.status, to: input.status });
  }
  if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
    changes.push({
      ...target,
      action: 'incident.assignee',
      from: existing.assigneeId,
      to: input.assigneeId,
    });
  }
  if (input.resolutionNote !== undefined && input.resolutionNote !== existing.resolutionNote) {
    changes.push({
      ...target,
      action: 'incident.note',
      from: existing.resolutionNote,
      to: input.resolutionNote,
    });
  }
  return changes;
}

// MTTA counts the first time anyone moved the incident out of open; MTTR the
// latest close. A reopen clears closedAt so the next close is measured, but
// keeps acknowledgedAt: someone already looked at it.
export function triageTimestamps(
  existing: { acknowledgedAt: Date | null },
  next: IncidentStatus,
  now: Date,
): { acknowledgedAt?: Date; closedAt?: Date | null } {
  if (next === 'open') return { closedAt: null };
  return {
    ...(!existing.acknowledgedAt && { acknowledgedAt: now }),
    ...(TERMINAL_STATUSES.has(next) && { closedAt: now }),
  };
}

export async function patchIncident(
  prisma: PrismaClient,
  incidentId: string,
  input: IncidentPatch,
  actor: Actor | null = null,
): Promise<PatchIncidentResult> {
  const existing = await prisma.incident.findUnique({ where: { incidentId } });
  if (!existing) return { ok: false, error: 'not_found' };

  if (input.status && !canTransition(existing.status, input.status)) {
    return { ok: false, error: 'invalid_transition' };
  }

  const nextStatus = input.status ?? existing.status;
  if (TERMINAL_STATUSES.has(nextStatus) && !input.resolutionNote && !existing.resolutionNote) {
    return { ok: false, error: 'resolution_note_required' };
  }

  if (input.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { userId: input.assigneeId } });
    if (!assignee) return { ok: false, error: 'assignee_not_found' };
  }

  const now = new Date();
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const changes = diffIncident(existing, input);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.incident.update({
      where: { incidentId },
      data: {
        status: input.status,
        assigneeId: input.assigneeId,
        resolutionNote: input.resolutionNote,
        updatedAt: now,
        ...(statusChanged && triageTimestamps(existing, nextStatus, now)),
      },
    });
    await recordAudit(tx, actor, changes, now);
    return row;
  });

  return { ok: true, incident: incidentRowToContract(updated) };
}
