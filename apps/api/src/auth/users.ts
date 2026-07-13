import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../incident/index.js';
import { hashPassword, verifyPassword } from './password.js';
import type { GoogleProfile } from './google.js';

export interface AuthUser {
  userId: string;
  email: string;
  name: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
    },
  });
  return { userId: user.userId, email: user.email, name: user.name };
}

export async function listUsers(prisma: PrismaClient): Promise<AuthUser[]> {
  const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
  return users.map((u) => ({ userId: u.userId, email: u.email, name: u.name }));
}

export async function loginWithPassword(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<AuthUser | undefined> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user?.passwordHash) return undefined; // no account, or Google-only account
  if (!(await verifyPassword(password, user.passwordHash))) return undefined;
  return { userId: user.userId, email: user.email, name: user.name };
}

// finds by googleId first, then by email (linking Google onto an existing
// password account with the same address), else creates a fresh Google-only
// account.
export async function upsertGoogleUser(
  prisma: PrismaClient,
  profile: GoogleProfile,
): Promise<AuthUser> {
  const email = normalizeEmail(profile.email);

  const byGoogleId = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  if (byGoogleId)
    return { userId: byGoogleId.userId, email: byGoogleId.email, name: byGoogleId.name };

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    const linked = await prisma.user.update({
      where: { userId: byEmail.userId },
      data: { googleId: profile.googleId, name: byEmail.name ?? profile.name },
    });
    return { userId: linked.userId, email: linked.email, name: linked.name };
  }

  const created = await prisma.user.create({
    data: { userId: randomUUID(), email, googleId: profile.googleId, name: profile.name },
  });
  return { userId: created.userId, email: created.email, name: created.name };
}
