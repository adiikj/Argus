import { randomUUID } from 'node:crypto';
import type { AuditAction, AuditEntry, Role } from '@argus/contracts';
import type { AuditEntry as AuditRow, Prisma, PrismaClient } from '../../generated/prisma/index.js';

// who made a change: the verified token's subject. null while the login gate
// is still open (fresh dev install, no accounts yet).
export interface Actor {
  userId: string;
  email: string;
  role: Role;
}

export interface AuditChange {
  action: AuditAction;
  targetType: 'incident' | 'user';
  targetId: string;
  from: string | null;
  to: string | null;
}

// notes can be long; the trail keeps enough to recognize one
const MAX_VALUE = 500;

function clip(value: string | null): string | null {
  return value && value.length > MAX_VALUE ? `${value.slice(0, MAX_VALUE - 1)}…` : value;
}

// takes a transaction client so a change and its audit rows commit together
export async function recordAudit(
  tx: Prisma.TransactionClient,
  actor: Actor | null,
  changes: AuditChange[],
  at: Date = new Date(),
): Promise<void> {
  if (changes.length === 0) return;
  await tx.auditEntry.createMany({
    data: changes.map((c) => ({
      id: randomUUID(),
      at,
      actorId: actor?.userId ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      action: c.action,
      targetType: c.targetType,
      targetId: c.targetId,
      fromValue: clip(c.from),
      toValue: clip(c.to),
    })),
  });
}

export function auditRowToContract(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    at: row.at.toISOString(),
    actor: row.actorId ? { userId: row.actorId, email: row.actorEmail, role: row.actorRole } : null,
    action: row.action as AuditAction,
    targetType: row.targetType as AuditEntry['targetType'],
    targetId: row.targetId,
    from: row.fromValue,
    to: row.toValue,
  };
}

export async function getIncidentActivity(
  prisma: PrismaClient,
  incidentId: string,
): Promise<AuditEntry[]> {
  const rows = await prisma.auditEntry.findMany({
    where: { targetType: 'incident', targetId: incidentId },
    orderBy: { at: 'asc' },
    take: 200,
  });
  return rows.map(auditRowToContract);
}

export async function listAudit(prisma: PrismaClient, limit = 100): Promise<AuditEntry[]> {
  const rows = await prisma.auditEntry.findMany({ orderBy: { at: 'desc' }, take: limit });
  return rows.map(auditRowToContract);
}

// viewers (the public demo account) never see other accounts' emails — the
// same reason GET /users is hidden from them. The role still shows.
export function redactActors(entries: AuditEntry[]): AuditEntry[] {
  return entries.map((e) => (e.actor ? { ...e, actor: { ...e.actor, email: null } } : e));
}
