import type { Role } from '@argus/contracts';

// the access model, three roles deep:
//   admin   everything, plus /admin/* (user roles, the global audit trail)
//   analyst triage: read everything, change incidents, run queries
//   viewer  read-only (the public demo account), and no account emails
//
// POSTs that only *read*, which a viewer may call. /incidents/query
// translates a question into a filter and searches; it changes nothing.
const VIEWER_READ_POSTS = ['/incidents/query'];

// viewer-forbidden reads: the user list exposes every account's email, and a
// viewer can't assign anyone anyway.
const VIEWER_HIDDEN_GETS = ['/users'];

const ADMIN_PREFIX = '/admin';

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

// pure decision for the api's auth hook. No role means the login gate is
// still open (fresh dev install, no accounts yet), where everything is allowed.
export function canAccess(role: Role | undefined, method: string, url: string): boolean {
  if (role === undefined || role === 'admin') return true;
  const path = url.split('?')[0] ?? url;
  if (under(path, ADMIN_PREFIX)) return false;
  if (role === 'analyst') return true;

  if (method === 'GET' || method === 'HEAD') {
    return !VIEWER_HIDDEN_GETS.some((p) => under(path, p));
  }
  return method === 'POST' && VIEWER_READ_POSTS.includes(path);
}
