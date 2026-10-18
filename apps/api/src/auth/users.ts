import { randomUUID } from 'node:crypto';
import type { AdminUser, Role } from '@argus/contracts';
import type { PrismaClient } from '../incident/index.js';
import { hashPassword, verifyPassword } from './password.js';
import type { GoogleProfile } from './google.js';
import { recordAudit, type Actor } from '../audit/index.js';

export interface AuthUser {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(row: { userId: string; email: string; name: string | null; role: Role }) {
  return { userId: row.userId, email: row.email, name: row.name, role: row.role };
}

// the very first account on an instance bootstraps it as admin; everyone
// after self-registers as analyst. Two simultaneous first sign-ups could both
// land as admin — acceptable for a fresh instance, not worth a lock.
async function roleForNewAccount(prisma: PrismaClient): Promise<Role> {
  return (await prisma.user.count()) === 0 ? 'admin' : 'analyst';
}

// undefined = email already taken
export async function registerUser(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<AuthUser | undefined> {
  const normalized = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return undefined;

  const user = await prisma.user.create({
    data: {
      userId: randomUUID(),
      email: normalized,
      passwordHash: await hashPassword(password),
      role: await roleForNewAccount(prisma),
    },
  });
  return toAuthUser(user);
}

// operator path (cli/create-user.ts): creates the account, or resets the
// password + role of an existing one — how the admin and the read-only demo
// account get made when self-registration is off.
export async function setPasswordUser(
  prisma: PrismaClient,
  email: string,
  password: string,
  role: Role,
): Promise<{ user: AuthUser; created: boolean }> {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    const user = await prisma.user.update({
      where: { userId: existing.userId },
      data: { passwordHash, role },
    });
    return { user: toAuthUser(user), created: false };
  }
  const user = await prisma.user.create({
    data: { userId: randomUUID(), email: normalized, passwordHash, role },
  });
  return { user: toAuthUser(user), created: true };
}

export async function listUsers(prisma: PrismaClient): Promise<AuthUser[]> {
  const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
  return users.map(toAuthUser);
}

// verified against when the account doesn't exist, so "no such email" costs
// the same scrypt round as "wrong password" — otherwise response timing alone
// tells an attacker which emails have accounts.
const DUMMY_HASH = await hashPassword(randomUUID());

export async function loginWithPassword(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<AuthUser | undefined> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !ok) return undefined; // no account, Google-only, or wrong password
  return toAuthUser(user);
}

// finds by googleId first, then by email (linking Google onto an existing
// password account with the same address), else creates a fresh Google-only
// account — unless allowCreate is false (self-registration disabled), in
// which case only accounts that already exist can sign in with Google.
export async function upsertGoogleUser(
  prisma: PrismaClient,
  profile: GoogleProfile,
  opts: { allowCreate: boolean },
): Promise<AuthUser | undefined> {
  const email = normalizeEmail(profile.email);

  const byGoogleId = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  if (byGoogleId) return toAuthUser(byGoogleId);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    const linked = await prisma.user.update({
      where: { userId: byEmail.userId },
      data: { googleId: profile.googleId, name: byEmail.name ?? profile.name },
    });
    return toAuthUser(linked);
  }

  if (!opts.allowCreate) return undefined;
  const created = await prisma.user.create({
    data: {
      userId: randomUUID(),
      email,
      googleId: profile.googleId,
      name: profile.name,
      role: await roleForNewAccount(prisma),
    },
  });
  return toAuthUser(created);
}

export async function listAdminUsers(prisma: PrismaClient): Promise<AdminUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return users.map((u) => ({
    userId: u.userId,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    signIn: [
      ...(u.passwordHash ? (['password'] as const) : []),
      ...(u.googleId ? (['google'] as const) : []),
    ],
  }));
}

export type SetRoleResult =
  { ok: true; user: AuthUser } | { ok: false; error: 'not_found' | 'last_admin' };

// admin-only role change, audited. Refuses to demote the last admin: with
// self-registration off there would be no way back short of the CLI.
// Serializable so two admins demoting each other at once can't both succeed.
export async function setUserRole(
  prisma: PrismaClient,
  actor: Actor | null,
  userId: string,
  role: Role,
): Promise<SetRoleResult> {
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { userId } });
      if (!user) return { ok: false, error: 'not_found' } as const;
      if (user.role === role) return { ok: true, user: toAuthUser(user) } as const;
      if (user.role === 'admin' && (await tx.user.count({ where: { role: 'admin' } })) <= 1) {
        return { ok: false, error: 'last_admin' } as const;
      }
      const updated = await tx.user.update({ where: { userId }, data: { role } });
      await recordAudit(tx, actor, [
        { action: 'user.role', targetType: 'user', targetId: userId, from: user.role, to: role },
      ]);
      return { ok: true, user: toAuthUser(updated) } as const;
    },
    { isolationLevel: 'Serializable' },
  );
}

// the role a user holds right now (undefined = account gone)
export async function currentRole(prisma: PrismaClient, userId: string): Promise<Role | undefined> {
  const user = await prisma.user.findUnique({ where: { userId }, select: { role: true } });
  return user?.role;
}
