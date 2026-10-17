import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../src/auth/token.js';

const SECRET = 'a-test-secret-at-least-16-chars';

describe('signToken / verifyToken', () => {
  it('round-trips real claims', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com', role: 'analyst' });
    const payload = await verifyToken(token, SECRET);
    expect(payload).toEqual({ sub: 'user-1', email: 'a@b.com', role: 'analyst' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com', role: 'analyst' });
    expect(await verifyToken(token, 'a-different-secret-16-chars')).toBeUndefined();
  });

  it('rejects a tampered token', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com', role: 'analyst' });
    // privilege escalation attempt: rewrite the role claim, keep the signature.
    // (Flipping the signature's last char isn't a reliable tamper — in
    // base64url it partly encodes padding bits, so it can decode identically.)
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString()) as object;
    const forged = Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url');
    expect(await verifyToken(`${header}.${forged}.${signature}`, SECRET)).toBeUndefined();
  });

  it('rejects a pre-roles token with no role claim', async () => {
    const { SignJWT } = await import('jose');
    const legacy = await new SignJWT({ email: 'a@b.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyToken(legacy, SECRET)).toBeUndefined();
  });

  it('rejects an expired token', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com', role: 'analyst' });
    const eightDaysLater = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(await verifyToken(token, SECRET, { now: eightDaysLater })).toBeUndefined();
  });
});
