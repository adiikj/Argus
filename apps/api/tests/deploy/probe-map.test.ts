import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// nginx writes a request to the probe log (shipped into Argus as real attack
// traffic) unless its path matches one of the map's "0" patterns. Every route
// the api or the generator serves must be on that list, or the console's own
// users show up as attackers: an admin opening the Access page would trip
// dir-enumeration (/admin) from their own IP.
const repo = (path: string) => new URL(`../../../../${path}`, import.meta.url);

const map = readFileSync(repo('deploy/nginx/argus-logging.conf'), 'utf8');
const allowed = [...map.matchAll(/^\s*~(\S+)\s+0;$/gm)].map(([, re]) => new RegExp(re!));

function isProbe(uri: string): boolean {
  return !allowed.some((re) => re.test(uri));
}

// route paths as registered in source, with :params filled in
function routes(path: string): string[] {
  const source = readFileSync(repo(path), 'utf8');
  return [...source.matchAll(/\b(?:app|scope)\.(?:get|post|patch|delete)\(\s*'([^']+)'/g)].map(
    ([, route]) => route!.replace(/:[^/]+/g, 'x'),
  );
}

describe('nginx probe map', () => {
  const served = [
    ...routes('apps/api/src/realtime/server.ts'),
    ...routes('apps/generator/src/server.ts'),
  ];

  it('finds the routes it checks', () => {
    expect(served).toEqual(expect.arrayContaining(['/incidents', '/admin/users', '/ingest']));
  });

  it.each(served)('does not log %s as a probe', (route) => {
    expect(isProbe(route)).toBe(false);
  });

  it.each(['/.env', '/wp-login.php', '/admin.php', '/administrator', '/cgi-bin/x', '/ingest/x'])(
    'still logs %s',
    (uri) => expect(isProbe(uri)).toBe(true),
  );
});
