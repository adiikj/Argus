import { z } from 'zod';
import { Source, type NormalizedEvent, type Severity } from '@argus/contracts';
import { windowStart, type PendingAlert, type Rule } from '../rule.js';
import { decodeRepeatedly } from '../rules/decode.js';
import {
  evaluateCondition,
  parseAggregation,
  parseCondition,
  type Aggregation,
  type Condition,
} from './condition.js';

// the event fields a rule may test, read straight off NormalizedEvent
const FIELDS = [
  'eventId',
  'timestamp',
  'source',
  'sourceIp',
  'outcome',
  'username',
  'method',
  'path',
  'statusCode',
  'userAgent',
  'raw',
] as const satisfies ReadonlyArray<keyof NormalizedEvent>;
type Field = (typeof FIELDS)[number];
const Field = z.enum(FIELDS);

const LEVELS: Record<string, Severity> = {
  informational: 'info',
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

const Scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// a fixture is one event, or a sequence (optionally repeated) whose last
// event must fire (match) or none of which may fire (nomatch). Fields left
// out get defaults (see fixtures.ts).
export const FixtureEvent = z
  .object({
    source: Source,
    sourceIp: z.string(),
    outcome: z.enum(['success', 'failure']),
    username: z.string(),
    method: z.string(),
    path: z.string(),
    statusCode: z.number().int(),
    userAgent: z.string(),
    raw: z.string(),
  })
  .partial()
  .strict();
export type FixtureEvent = z.infer<typeof FixtureEvent>;

export const Fixture = z.union([
  z
    .object({
      events: z.array(FixtureEvent).min(1),
      repeat: z.number().int().positive().max(1000).optional(),
    })
    .strict(),
  FixtureEvent,
]);
export type Fixture = z.infer<typeof Fixture>;

// a Sigma rule document, plus two Argus blocks: `argus` (how the alert reads)
// and `tests` (fixtures every rule must carry). Unknown keys are rejected so
// a typo can't silently disable part of a rule.
export const RuleDoc = z
  .object({
    title: z.string(),
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    status: z.enum(['stable', 'test', 'experimental']).optional(),
    description: z.string().optional(),
    references: z.array(z.string()).optional(),
    author: z.string().optional(),
    date: z.string().optional(),
    tags: z.array(z.string()).default([]),
    logsource: z
      .object({
        product: z.literal('argus').optional(),
        service: z.union([Source, z.array(Source).min(1)]).optional(),
      })
      .strict(),
    detection: z.record(z.string(), z.unknown()),
    timeframe: z
      .string()
      .regex(/^\d+[smhd]$/)
      .optional(),
    level: z.enum(['informational', 'low', 'medium', 'high', 'critical']),
    falsepositives: z.array(z.string()).optional(),
    argus: z
      .object({
        message: z.string(),
        entity: Field.default('sourceIp'),
      })
      .strict(),
    tests: z
      .object({
        match: z.array(Fixture).min(1),
        nomatch: z.array(Fixture).min(1),
      })
      .strict(),
  })
  .strict();
export type RuleDoc = z.infer<typeof RuleDoc>;

type FieldValue = string | number | boolean | undefined;
type Matcher = (event: NormalizedEvent) => boolean;

const TRANSFORMS = new Set(['urldecode']);
const OPERATORS = new Set(['contains', 'startswith', 'endswith', 're', 'exists']);
const FLAGS = new Set(['all', 'cased', 'i']);

function escapeRegExp(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\*]/g, '\\$&');
}

// Sigma wildcards in plain values: * = any run, ? = one char, \* \? \\ = literal
function wildcardSource(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i]!;
    if (c === '\\' && i + 1 < value.length && '*?\\'.includes(value[i + 1]!)) {
      out += escapeRegExp(value[++i]!);
    } else if (c === '*') out += '.*';
    else if (c === '?') out += '.';
    else out += escapeRegExp(c);
  }
  return out;
}

// one "field|mod|mod: value(s)" entry -> a predicate on the event
function compileFieldMatch(key: string, raw: unknown, where: string): Matcher {
  const [fieldName, ...mods] = key.split('|');
  const field = Field.safeParse(fieldName);
  if (!field.success) throw new Error(`${where}: unknown field "${fieldName}"`);
  for (const mod of mods) {
    if (!TRANSFORMS.has(mod) && !OPERATORS.has(mod) && !FLAGS.has(mod)) {
      throw new Error(`${where}: unsupported modifier "${mod}"`);
    }
  }
  const ops = mods.filter((m) => OPERATORS.has(m));
  if (ops.length > 1) throw new Error(`${where}: more than one operator in "${key}"`);
  const op = ops[0] ?? 'equals';
  if (mods.includes('i') && op !== 're') throw new Error(`${where}: "i" only applies to re`);
  const decode = mods.includes('urldecode');
  const all = mods.includes('all');
  const cased = mods.includes('cased');

  const values = z
    .array(Scalar)
    .min(1)
    .safeParse(Array.isArray(raw) ? raw : [raw]);
  if (!values.success) throw new Error(`${where}: "${key}" needs a value or a list of values`);
  const read = (event: NormalizedEvent): FieldValue => {
    const v = event[field.data as Field];
    return decode && typeof v === 'string' ? decodeRepeatedly(v) : v;
  };

  if (op === 'exists') {
    const [want] = values.data;
    if (typeof want !== 'boolean') throw new Error(`${where}: exists takes true or false`);
    return (event) => {
      const v = read(event);
      return (v !== undefined && v !== '') === want;
    };
  }

  const tests = values.data.map((value): ((v: FieldValue) => boolean) => {
    if (value === null) return (v) => v === undefined || v === '';
    if (typeof value === 'number' || typeof value === 'boolean') {
      if (op !== 'equals') throw new Error(`${where}: ${op} needs a string value`);
      return (v) => v === value || (typeof v === 'string' && v === String(value));
    }
    let pattern: RegExp;
    if (op === 're') {
      try {
        pattern = new RegExp(value, mods.includes('i') ? 'i' : '');
      } catch (err) {
        throw new Error(`${where}: invalid regex ${value} (${(err as Error).message})`);
      }
    } else {
      const body = wildcardSource(value);
      const anchored =
        op === 'contains'
          ? body
          : op === 'startswith'
            ? `^${body}`
            : op === 'endswith'
              ? `${body}$`
              : `^${body}$`;
      pattern = new RegExp(anchored, cased ? 's' : 'is');
    }
    return (v) => v !== undefined && pattern.test(String(v));
  });

  return (event) => {
    const v = read(event);
    return all ? tests.every((t) => t(v)) : tests.some((t) => t(v));
  };
}

// a selection is a map (every field must match) or a list of maps (any)
function compileSelection(name: string, body: unknown, ruleId: string): Matcher {
  const where = `${ruleId}: selection "${name}"`;
  const maps = Array.isArray(body) ? body : [body];
  if (maps.length === 0) throw new Error(`${where} is empty`);
  const alternatives = maps.map((map) => {
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
      throw new Error(`${where} must be a map of field: value`);
    }
    const entries = Object.entries(map);
    if (entries.length === 0) throw new Error(`${where} is empty`);
    const matchers = entries.map(([key, value]) => compileFieldMatch(key, value, where));
    return (event: NormalizedEvent) => matchers.every((m) => m(event));
  });
  return (event) => alternatives.some((m) => m(event));
}

const PLACEHOLDER = /\{(\w+)(?:\|([^}]*))?\}/g;

// "{field}", "{field|fallback}" and "{count}" in argus.message
function compileMessage(template: string, ruleId: string) {
  for (const [, name] of template.matchAll(PLACEHOLDER)) {
    if (name !== 'count' && !Field.safeParse(name).success) {
      throw new Error(`${ruleId}: message uses unknown field {${name}}`);
    }
  }
  return (event: NormalizedEvent, count: number | undefined): string =>
    template.replace(PLACEHOLDER, (_, name: string, fallback: string | undefined) => {
      const v = name === 'count' ? count : event[name as Field];
      return v === undefined || v === '' ? (fallback ?? 'unknown') : String(v);
    });
}

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

function timeframeMs(timeframe: string): number {
  return Number(timeframe.slice(0, -1)) * UNIT_MS[timeframe.at(-1) as keyof typeof UNIT_MS];
}

function crossed(agg: Aggregation, n: number): boolean {
  return agg.op === '>'
    ? n > agg.threshold
    : agg.op === '>='
      ? n >= agg.threshold
      : n === agg.threshold;
}

const MAX_CITED_EVENTS = 100;

export interface CompiledRule {
  rule: Rule;
  doc: RuleDoc;
  severity: Severity;
}

export function compileRule(doc: RuleDoc): CompiledRule {
  const { condition: conditionSource, ...selectionBodies } = doc.detection;
  if (typeof conditionSource !== 'string') {
    throw new Error(`${doc.id}: detection.condition must be a string`);
  }
  const names = Object.keys(selectionBodies);
  if (names.length === 0) throw new Error(`${doc.id}: detection has no selections`);
  const selections = new Map(
    names.map((name) => [name, compileSelection(name, selectionBodies[name], doc.id)]),
  );

  const [expression, aggregationSource, ...rest] = conditionSource.split('|');
  if (rest.length > 0) throw new Error(`${doc.id}: more than one "|" in condition`);
  let condition: Condition;
  let aggregation: Aggregation | undefined;
  try {
    condition = parseCondition(expression!, names);
    aggregation = aggregationSource === undefined ? undefined : parseAggregation(aggregationSource);
  } catch (err) {
    throw new Error(`${doc.id}: ${(err as Error).message}`);
  }
  for (const f of [...(aggregation?.groupBy ?? []), aggregation?.distinctField ?? 'source']) {
    if (!Field.safeParse(f).success) throw new Error(`${doc.id}: unknown field "${f}" in count`);
  }
  if (aggregation && !doc.timeframe) throw new Error(`${doc.id}: count() needs a timeframe`);
  if (!aggregation && doc.timeframe) throw new Error(`${doc.id}: timeframe without count()`);

  const services = doc.logsource.service;
  const sources = services === undefined ? undefined : new Set([services].flat());
  const message = compileMessage(doc.argus.message, doc.id);
  const severity = LEVELS[doc.level]!;
  const entityField = doc.argus.entity;

  const matches = (event: NormalizedEvent): boolean => {
    if (sources && !sources.has(event.source)) return false;
    const results = new Map<string, boolean>();
    return evaluateCondition(condition, (name) => {
      let hit = results.get(name);
      if (hit === undefined) {
        hit = selections.get(name)!(event);
        results.set(name, hit);
      }
      return hit;
    });
  };

  const alert = (
    event: NormalizedEvent,
    extra: Pick<PendingAlert, 'eventIds' | 'count' | 'firstSeenAt'>,
  ): PendingAlert => ({
    ruleId: doc.id,
    severity,
    entity: String(event[entityField] ?? event.sourceIp),
    message: message(event, extra.count),
    ...extra,
  });

  if (!aggregation) {
    return {
      doc,
      severity,
      rule: {
        kind: 'stateless',
        id: doc.id,
        evaluate: (event) =>
          matches(event) ? alert(event, { eventIds: [event.eventId] }) : undefined,
      },
    };
  }

  const agg = aggregation;
  const windowMs = timeframeMs(doc.timeframe!);
  return {
    doc,
    severity,
    rule: {
      kind: 'stateful',
      id: doc.id,
      evaluate: async (event, ctx) => {
        if (!matches(event)) return undefined;
        const key = agg.groupBy.map((f) => String(event[f as Field] ?? '')).join('|');
        const events = await ctx.window.record(`events:${key}`, event.eventId, windowMs);
        let n = events.length;
        if (agg.distinctField) {
          const value = event[agg.distinctField as Field];
          if (value === undefined || value === '') return undefined;
          n = (await ctx.window.record(`distinct:${key}`, String(value), windowMs)).length;
        }
        if (!crossed(agg, n)) return undefined;
        return alert(event, {
          eventIds: events.slice(-MAX_CITED_EVENTS).map((e) => e.eventId),
          count: n,
          firstSeenAt: windowStart(events),
        });
      },
    },
  };
}
