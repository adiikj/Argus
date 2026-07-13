import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const TOKEN_TTL = '7d';

export interface AppTokenPayload {
  sub: string;
  email: string;
}

export async function signToken(secret: string, payload: AppTokenPayload): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ email: payload.email })
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
      currentDate: opts.now,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return undefined;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return undefined;
  }
}
