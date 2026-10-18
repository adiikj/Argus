import type { Role } from '@argus/contracts';
import type { PrismaClient } from '../incident/index.js';
import { signToken, verifyToken, type AppTokenPayload } from './token.js';
import {
  currentRole,
  registerUser,
  loginWithPassword,
  upsertGoogleUser,
  type AuthUser,
} from './users.js';
import { verifyGoogleIdToken } from './google.js';

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export type RegisterResult =
  { ok: true; result: AuthResult } | { ok: false; error: 'taken' | 'disabled' };

export interface AuthService {
  readonly googleClientId: string | undefined;
  readonly registrationOpen: boolean;
  isRequired(): boolean;
  register(email: string, password: string): Promise<RegisterResult>;
  login(email: string, password: string): Promise<AuthResult | undefined>;
  loginWithGoogle(idToken: string): Promise<AuthResult | undefined>;
  verify(token: string): Promise<AppTokenPayload | undefined>;
  // drop a user's cached role after an admin changes it
  forgetRole(userId: string): void;
}

// how long a looked-up role is trusted before asking Postgres again
const ROLE_TTL_MS = 30_000;

// two gate modes:
//   - registration open (dev default): the gate activates the moment the
//     first account registers — a fresh install stays fully open until then.
//     Seeded once at boot from a real count, flipped in-process on first
//     success so gated requests never need a DB round trip to check it.
//   - registration closed (ALLOW_REGISTRATION=false, prod): the gate is on
//     from boot even with zero users, so nobody can claim a fresh public
//     deploy by being first to /login. Accounts come from cli/create-user.
//
// Known limitation, not solved here: with multiple api instances each holds
// its own copy of the open-mode flag and can briefly disagree right after the
// very first registration — not worth Redis-backing for this project's scope.
export async function createAuthService(
  prisma: PrismaClient,
  opts: { authSecret: string; googleClientId?: string; allowRegistration: boolean },
): Promise<AuthService> {
  let required = !opts.allowRegistration || (await prisma.user.count()) > 0;
  const roles = new Map<string, { role: Role; at: number }>();

  const issue = async (user: AuthUser): Promise<AuthResult> => ({
    user,
    token: await signToken(opts.authSecret, {
      sub: user.userId,
      email: user.email,
      role: user.role,
    }),
  });

  return {
    googleClientId: opts.googleClientId,
    registrationOpen: opts.allowRegistration,
    isRequired: () => required,

    async register(email, password) {
      if (!opts.allowRegistration) return { ok: false, error: 'disabled' };
      const user = await registerUser(prisma, email, password);
      if (!user) return { ok: false, error: 'taken' };
      required = true;
      return { ok: true, result: await issue(user) };
    },

    async login(email, password) {
      const user = await loginWithPassword(prisma, email, password);
      return user ? issue(user) : undefined;
    },

    async loginWithGoogle(idToken) {
      if (!opts.googleClientId) return undefined;
      const profile = await verifyGoogleIdToken(idToken, opts.googleClientId);
      if (!profile) return undefined;
      const user = await upsertGoogleUser(prisma, profile, {
        allowCreate: opts.allowRegistration,
      });
      if (!user) return undefined;
      required = true;
      return issue(user);
    },

    // the token proves who the caller is; the role comes from the database
    // (cached briefly), so a demotion or a deleted account takes effect
    // within ROLE_TTL_MS instead of whenever the 7-day token expires
    async verify(token) {
      const payload = await verifyToken(token, opts.authSecret);
      if (!payload) return undefined;
      const cached = roles.get(payload.sub);
      let role = cached && Date.now() - cached.at < ROLE_TTL_MS ? cached.role : undefined;
      if (!role) {
        role = await currentRole(prisma, payload.sub);
        if (!role) return undefined;
        roles.set(payload.sub, { role, at: Date.now() });
      }
      return { ...payload, role };
    },

    forgetRole: (userId) => void roles.delete(userId),
  };
}
