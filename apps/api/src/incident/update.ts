import type { Incident, IncidentPatch, IncidentStatus } from '@argus/contracts';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { canTransition } from './transitions.js';
import { incidentRowToContract } from './mappers.js';

export type PatchIncidentError =
  'not_found' | 'invalid_transition' | 'resolution_note_required' | 'assignee_not_found';

export type PatchIncidentResult =
  { ok: true; incident: Incident } | { ok: false; error: PatchIncidentError };

const TERMINAL_STATUSES = new Set(['resolved', 'false_positive']);

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
  const updated = await prisma.incident.update({
    where: { incidentId },
    data: {
      status: input.status,
      assigneeId: input.assigneeId,
      resolutionNote: input.resolutionNote,
      updatedAt: now,
      ...(statusChanged && triageTimestamps(existing, nextStatus, now)),
    },
  });

  return { ok: true, incident: incidentRowToContract(updated) };
}
