import { SignJWT, jwtVerify } from 'jose';
import { Role } from '@argus/contracts';

const ALG = 'HS256';
const TOKEN_TTL = '7d';

export interface AppTokenPayload {
  sub: string;
  email: string;
  // baked in at sign-in: a role change applies from the user's next login
  role: Role;
}

export async function signToken(secret: string, payload: AppTokenPayload): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(key);
}

// `now` lets expiry be unit-tested without real sleeping — same override
// pattern as RateLimiter.tryConsume(key, now = Date.now()).
export async function verifyToken(
  token: string,
  secret: string,
  opts: { now?: Date } = {},
): Promise<AppTokenPayload | undefined> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: [ALG],
      currentDate: opts.now,
    });
    const role = Role.safeParse(payload.role);
    // pre-roles tokens carry no role claim — rejected, so they just re-login
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || !role.success) {
      return undefined;
    }
    return { sub: payload.sub, email: payload.email, role: role.data };
  } catch {
    return undefined;
  }
}
