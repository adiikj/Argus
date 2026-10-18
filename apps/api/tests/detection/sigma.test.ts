import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import {
  compileRule,
  evaluateCondition,
  parseAggregation,
  parseCondition,
  RuleDoc,
  runFixtures,
} from '../../src/detection/sigma/index.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';

let n = 0;
function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  n += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    timestamp: '2026-10-18T09:00:00.000Z',
    source: 'nginx',
    sourceIp: '198.51.100.9',
    outcome: 'failure',
    raw: '',
    ...overrides,
  };
}

// a minimal valid rule; each test overrides what it exercises
function doc(overrides: Record<string, unknown>) {
  return RuleDoc.parse({
    title: 'Test rule',
    id: 'test-rule',
    logsource: { product: 'argus' },
    level: 'medium',
    argus: { message: 'hit from {sourceIp}' },
    tests: { match: [{ path: '/x' }], nomatch: [{ path: '/y' }] },
    ...overrides,
  });
}

function matcher(detection: Record<string, unknown>) {
  const { rule } = compileRule(doc({ detection }));
  if (rule.kind !== 'stateless') throw new Error('expected stateless');
  return (e: Partial<NormalizedEvent>) => rule.evaluate(event(e)) !== undefined;
}

describe('condition parser', () => {
  const names = ['a', 'b', 'c', 'sel_one', 'sel_two'];
  const run = (source: string, hits: string[]) =>
    evaluateCondition(parseCondition(source, names), (name) => hits.includes(name));

  it('binds not > and > or', () => {
    expect(run('a or b and c', ['a'])).toBe(true);
    expect(run('a or b and c', ['b'])).toBe(false);
    expect(run('not a and b', ['b'])).toBe(true);
    expect(run('not (a or b)', ['b'])).toBe(false);
  });

  it('expands "1 of" / "all of" over wildcards and "them"', () => {
    expect(run('1 of sel_*', ['sel_two'])).toBe(true);
    expect(run('all of sel_*', ['sel_two'])).toBe(false);
    expect(run('all of sel_*', ['sel_one', 'sel_two'])).toBe(true);
    expect(run('1 of them', ['c'])).toBe(true);
  });

  it('rejects unknown selections and broken syntax', () => {
    expect(() => parseCondition('nope', names)).toThrow(/unknown selection/);
    expect(() => parseCondition('1 of x*', names)).toThrow(/matches no selection/);
    expect(() => parseCondition('(a or b', names)).toThrow();
    expect(() => parseCondition('a b', names)).toThrow(/unexpected/);
  });

  it('parses aggregations', () => {
    expect(parseAggregation(' count() by sourceIp, username >= 5')).toEqual({
      distinctField: undefined,
      groupBy: ['sourceIp', 'username'],
      op: '>=',
      threshold: 5,
    });
    expect(parseAggregation('count(username) by sourceIp > 4').distinctField).toBe('username');
    expect(() => parseAggregation('count() < 3')).toThrow(/unsupported aggregation/);
  });
});

describe('field modifiers', () => {
  it('equals is case-insensitive with Sigma wildcards, unless cased', () => {
    const m = matcher({ s: { path: '/Admin*' }, condition: 's' });
    expect(m({ path: '/admin/panel' })).toBe(true);
    expect(m({ path: '/x/admin' })).toBe(false);
    const cased = matcher({ s: { 'path|cased': '/Admin' }, condition: 's' });
    expect(cased({ path: '/admin' })).toBe(false);
    expect(cased({ path: '/Admin' })).toBe(true);
  });

  it('escapes wildcards with a backslash', () => {
    const m = matcher({ s: { 'path|endswith': '\\*' }, condition: 's' });
    expect(m({ path: '/a*' })).toBe(true);
    expect(m({ path: '/ab' })).toBe(false);
  });

  it('contains / startswith / endswith, and |all', () => {
    expect(matcher({ s: { 'path|contains': 'etc' }, condition: 's' })({ path: '/x/etc/y' })).toBe(
      true,
    );
    const all = matcher({ s: { 'path|contains|all': ['a', 'b'] }, condition: 's' });
    expect(all({ path: '/ab' })).toBe(true);
    expect(all({ path: '/a' })).toBe(false);
    expect(matcher({ s: { 'path|startswith': '/api' }, condition: 's' })({ path: '/x/api' })).toBe(
      false,
    );
  });

  it('urldecode runs before matching', () => {
    const m = matcher({ s: { 'path|urldecode|contains': '<script' }, condition: 's' });
    expect(m({ path: '/q?x=%253Cscript%253E' })).toBe(true);
  });

  it('matches numbers, null (absent) and exists', () => {
    expect(matcher({ s: { statusCode: 401 }, condition: 's' })({ statusCode: 401 })).toBe(true);
    expect(matcher({ s: { statusCode: 401 }, condition: 's' })({ statusCode: 403 })).toBe(false);
    const noUser = matcher({ s: { username: null }, condition: 's' });
    expect(noUser({})).toBe(true);
    expect(noUser({ username: 'root' })).toBe(false);
    const hasAgent = matcher({ s: { 'userAgent|exists': true }, condition: 's' });
    expect(hasAgent({ userAgent: 'curl' })).toBe(true);
    expect(hasAgent({})).toBe(false);
  });

  it('a list of maps is OR, a map is AND', () => {
    const m = matcher({
      s: [{ source: 'auth', outcome: 'success' }, { statusCode: 500 }],
      condition: 's',
    });
    expect(m({ source: 'auth', outcome: 'success' })).toBe(true);
    expect(m({ source: 'auth', outcome: 'failure' })).toBe(false);
    expect(m({ statusCode: 500 })).toBe(true);
  });
});

describe('aggregation rules', () => {
  it('count(field) counts distinct values per group', async () => {
    const { rule } = compileRule(
      doc({
        logsource: { product: 'argus', service: 'auth' },
        detection: {
          failed: { outcome: 'failure' },
          condition: 'failed | count(username) by sourceIp >= 3',
        },
        timeframe: '5m',
        argus: { message: '{count} accounts from {sourceIp}' },
      }),
    );
    if (rule.kind !== 'stateful') throw new Error('expected stateful');
    const ctx = { window: new InMemoryWindowStore(), baseline: new InMemoryBaselineStore() };
    const fire = (username: string) => rule.evaluate(event({ source: 'auth', username }), ctx);

    expect(await fire('a')).toBeUndefined();
    expect(await fire('a')).toBeUndefined(); // same account again: still 1 distinct
    expect(await fire('b')).toBeUndefined();
    const alert = await fire('c');
    expect(alert).toMatchObject({ count: 3, message: '3 accounts from 198.51.100.9' });
    expect(alert?.eventIds).toHaveLength(4); // cites every failure, not just distinct ones
  });
});

describe('rule validation', () => {
  const compile = (overrides: Record<string, unknown>) => () => compileRule(doc(overrides));
  const s = { s: { path: '/x' } };

  it.each([
    [{ detection: { s: { pth: '/x' }, condition: 's' } }, /unknown field "pth"/],
    [{ detection: { s: { 'path|contians': 'x' }, condition: 's' } }, /unsupported modifier/],
    [{ detection: { s: { 'path|re': '(' }, condition: 's' } }, /invalid regex/],
    [{ detection: { s: { 'path|contains|i': 'x' }, condition: 's' } }, /only applies to re/],
    [{ detection: { ...s, condition: 's | count() > 3' } }, /needs a timeframe/],
    [{ detection: { ...s, condition: 's' }, timeframe: '1m' }, /timeframe without count/],
    [
      { detection: { ...s, condition: 's' }, argus: { message: '{nope}' } },
      /unknown field \{nope\}/,
    ],
    [{ detection: { ...s } }, /condition must be a string/],
  ])('rejects %j', (overrides, error) => {
    expect(compile(overrides)).toThrow(error);
  });

  it('requires match and nomatch fixtures', () => {
    expect(() => doc({ detection: { ...s, condition: 's' }, tests: { match: [] } })).toThrow();
  });

  it('rejects unknown top-level keys', () => {
    expect(() => doc({ detection: { ...s, condition: 's' }, levle: 'high' })).toThrow();
  });
});

describe('fixture runner', () => {
  it('reports fixtures a rule gets wrong', async () => {
    const compiled = compileRule(
      doc({
        detection: { s: { 'path|startswith': '/x' }, condition: 's' },
        tests: { match: [{ path: '/x' }, { path: '/nope' }], nomatch: [{ path: '/xyz' }] },
      }),
    );
    expect(await runFixtures(compiled)).toEqual([
      'should match: {"path":"/nope"}',
      'should not match: {"path":"/xyz"}',
    ]);
  });
});
