import type { PrismaClient } from '../incident/index.js';
import { signToken, verifyToken, type AppTokenPayload } from './token.js';
import { registerUser, loginWithPassword, upsertGoogleUser, type AuthUser } from './users.js';
import { verifyGoogleIdToken } from './google.js';

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export interface AuthService {
  readonly googleClientId: string | undefined;
  isRequired(): boolean;
  register(email: string, password: string): Promise<AuthResult | undefined>;
  login(email: string, password: string): Promise<AuthResult | undefined>;
  loginWithGoogle(idToken: string): Promise<AuthResult | undefined>;
  verify(token: string): Promise<AppTokenPayload | undefined>;
}

// the login gate activates the moment the first account is registered — a
// fresh install stays fully open (frictionless local dev) until then. Seeded
// once at boot from a real count, flipped in-process on first success so
// gated requests never need a DB round trip just to check this.
//
// Known limitation, not solved here: with multiple api instances each holds
// its own copy of this flag and can briefly disagree right after the very
// first registration — not worth Redis-backing for this project's scope.
export async function createAuthService(
  prisma: PrismaClient,
  opts: { authSecret: string; googleClientId?: string },
): Promise<AuthService> {
  let required = (await prisma.user.count()) > 0;

  const issue = async (user: AuthUser): Promise<AuthResult> => ({
    user,
    token: await signToken(opts.authSecret, { sub: user.userId, email: user.email }),
  });

  return {
    googleClientId: opts.googleClientId,
    isRequired: () => required,

    async register(email, password) {
      const user = await registerUser(prisma, email, password);
      if (!user) return undefined;
      required = true;
      return issue(user);
    },

    async login(email, password) {
      const user = await loginWithPassword(prisma, email, password);
      return user ? issue(user) : undefined;
    },

    async loginWithGoogle(idToken) {
      if (!opts.googleClientId) return undefined;
      const profile = await verifyGoogleIdToken(idToken, opts.googleClientId);
      if (!profile) return undefined;
      required = true;
      return issue(await upsertGoogleUser(prisma, profile));
    },

    verify: (token) => verifyToken(token, opts.authSecret),
  };
}
