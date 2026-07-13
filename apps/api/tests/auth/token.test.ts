import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../src/auth/token.js';

const SECRET = 'a-test-secret-at-least-16-chars';

describe('signToken / verifyToken', () => {
  it('round-trips real claims', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com' });
    const payload = await verifyToken(token, SECRET);
    expect(payload).toEqual({ sub: 'user-1', email: 'a@b.com' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com' });
    expect(await verifyToken(token, 'a-different-secret-16-chars')).toBeUndefined();
  });

  it('rejects a tampered token', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com' });
    const tampered = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');
    expect(await verifyToken(tampered, SECRET)).toBeUndefined();
  });

  it('rejects an expired token', async () => {
    const token = await signToken(SECRET, { sub: 'user-1', email: 'a@b.com' });
    const eightDaysLater = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(await verifyToken(token, SECRET, { now: eightDaysLater })).toBeUndefined();
  });
});
