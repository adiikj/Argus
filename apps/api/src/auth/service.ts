import type { PrismaClient } from '../incident/index.js';
import { signToken, verifyToken, type AppTokenPayload } from './token.js';
import { registerUser, loginWithPassword, upsertGoogleUser, type AuthUser } from './users.js';
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
}

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

    verify: (token) => verifyToken(token, opts.authSecret),
  };
}
