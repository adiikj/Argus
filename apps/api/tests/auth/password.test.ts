import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password against its own hash', async () => {
    const stored = await hashPassword('correcthorsebatterystaple');
    expect(await verifyPassword('correcthorsebatterystaple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correcthorsebatterystaple');
    expect(await verifyPassword('wrongpassword', stored)).toBe(false);
  });

  it('salts each hash differently for the same password', async () => {
    const a = await hashPassword('samepassword');
    const b = await hashPassword('samepassword');
    expect(a).not.toBe(b);
  });

  it('rejects a malformed stored value', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-stored-hash')).toBe(false);
  });
});
