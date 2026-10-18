import { describe, expect, it } from 'vitest';
import { canAccess } from '../../src/auth/permissions.js';

describe('canAccess', () => {
  it('lets admins and analysts triage and read', () => {
    for (const role of ['admin', 'analyst'] as const) {
      expect(canAccess(role, 'PATCH', '/incidents/abc')).toBe(true);
      expect(canAccess(role, 'GET', '/users')).toBe(true);
    }
  });

  it('keeps /admin for admins', () => {
    expect(canAccess('admin', 'GET', '/admin/users')).toBe(true);
    expect(canAccess('admin', 'PATCH', '/admin/users/abc')).toBe(true);
    for (const role of ['analyst', 'viewer'] as const) {
      expect(canAccess(role, 'GET', '/admin/users')).toBe(false);
      expect(canAccess(role, 'GET', '/admin/audit?limit=5')).toBe(false);
      expect(canAccess(role, 'PATCH', '/admin/users/abc')).toBe(false);
      expect(canAccess(role, 'GET', '/admin')).toBe(false);
    }
    // a prefix, not a substring
    expect(canAccess('analyst', 'GET', '/administrators')).toBe(true);
  });

  it('allows everything while the gate is open (no role)', () => {
    expect(canAccess(undefined, 'PATCH', '/incidents/abc')).toBe(true);
  });

  it('lets a viewer read', () => {
    expect(canAccess('viewer', 'GET', '/incidents')).toBe(true);
    expect(canAccess('viewer', 'GET', '/events?q=foo')).toBe(true);
    expect(canAccess('viewer', 'GET', '/soc-metrics?days=7')).toBe(true);
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
