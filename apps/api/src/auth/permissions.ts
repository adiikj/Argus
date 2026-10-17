import type { Role } from '@argus/contracts';

// POSTs that only *read* — a viewer may call these. /incidents/query
// translates a question into a filter and searches; it changes nothing.
const VIEWER_READ_POSTS = ['/incidents/query'];

// viewer-forbidden reads: the user list exposes every account's email, and a
// viewer can't assign anyone anyway.
const VIEWER_HIDDEN_GETS = ['/users'];

// pure decision for the api's auth hook — no role means the login gate is
// still open (fresh dev install), where everything is allowed.
export function canAccess(role: Role | undefined, method: string, url: string): boolean {
  if (role !== 'viewer') return true;
  const path = url.split('?')[0] ?? url;

  if (method === 'GET' || method === 'HEAD') {
    return !VIEWER_HIDDEN_GETS.some((p) => path === p || path.startsWith(`${p}/`));
  }
  return method === 'POST' && VIEWER_READ_POSTS.includes(path);
}
