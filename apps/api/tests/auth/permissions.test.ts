import { describe, expect, it } from 'vitest';
import { canAccess } from '../../src/auth/permissions.js';

describe('canAccess', () => {
  it('lets admins and analysts do anything', () => {
    for (const role of ['admin', 'analyst'] as const) {
      expect(canAccess(role, 'PATCH', '/incidents/abc')).toBe(true);
      expect(canAccess(role, 'GET', '/users')).toBe(true);
    }
  });

  it('allows everything while the gate is open (no role)', () => {
    expect(canAccess(undefined, 'PATCH', '/incidents/abc')).toBe(true);
  });

  it('lets a viewer read', () => {
    expect(canAccess('viewer', 'GET', '/incidents')).toBe(true);
    expect(canAccess('viewer', 'GET', '/events?q=foo')).toBe(true);
    expect(canAccess('viewer', 'POST', '/incidents/query')).toBe(true);
  });

  it('blocks viewer writes', () => {
    expect(canAccess('viewer', 'PATCH', '/incidents/abc')).toBe(false);
    expect(canAccess('viewer', 'DELETE', '/incidents/abc')).toBe(false);
    expect(canAccess('viewer', 'POST', '/incidents/query/../abc')).toBe(false);
  });

  it('hides the user list (every account email) from viewers', () => {
    expect(canAccess('viewer', 'GET', '/users')).toBe(false);
    expect(canAccess('viewer', 'GET', '/users?x=1')).toBe(false);
  });
});
