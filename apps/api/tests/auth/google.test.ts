import { describe, it, expect } from 'vitest';
import { verifyGoogleIdToken } from '../../src/auth/google.js';

describe('verifyGoogleIdToken', () => {
  // deterministic path only — jose rejects a malformed JWT before ever
  // touching the network/JWKS, so this needs no mocking. A real signed
  // Google token isn't worth faking here; that path is live-verified.
  it('rejects a malformed token without making a network call', async () => {
    const result = await verifyGoogleIdToken('not-a-real-jwt', 'some-client-id');
    expect(result).toBeUndefined();
  });
});
