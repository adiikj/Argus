import { randomUUID } from 'node:crypto';
import type { NormalizedEvent } from '@argus/contracts';
import { InMemoryWindowStore } from '../window-store.js';
import { InMemoryBaselineStore } from '../baseline-store.js';
import type { PendingAlert } from '../rule.js';
import type { CompiledRule, Fixture, FixtureEvent } from './compile.js';

function toEvent(rule: CompiledRule, partial: FixtureEvent): NormalizedEvent {
  const service = rule.doc.logsource.service;
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    source: [service ?? 'nginx'].flat()[0]!,
    sourceIp: '198.51.100.9',
    outcome: 'failure',
    raw: '',
    ...partial,
  };
}

function sequence(fixture: Fixture): FixtureEvent[] {
  if ('events' in fixture && Array.isArray(fixture.events)) {
    const repeat = 'repeat' in fixture && typeof fixture.repeat === 'number' ? fixture.repeat : 1;
    return Array.from({ length: repeat }, () => fixture.events).flat();
  }
  return [fixture as FixtureEvent];
}

function describe(fixture: Fixture): string {
  const text = JSON.stringify(fixture);
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

// runs every fixture in the rule's `tests` block against a fresh window, and
// returns what went wrong (empty = all good). match: the last event of the
// sequence must fire, with the rule's own id and level. nomatch: nothing may.
export async function runFixtures(rule: CompiledRule): Promise<string[]> {
  const failures: string[] = [];
  const run = async (fixture: Fixture) => {
    const ctx = { window: new InMemoryWindowStore(), baseline: new InMemoryBaselineStore() };
    const results: Array<PendingAlert | undefined> = [];
    for (const partial of sequence(fixture)) {
      const event = toEvent(rule, partial);
      results.push(
        rule.rule.kind === 'stateless'
          ? rule.rule.evaluate(event)
          : await rule.rule.evaluate(event, ctx),
      );
    }
    return results;
  };

  for (const fixture of rule.doc.tests.match) {
    const last = (await run(fixture)).at(-1);
    if (!last) failures.push(`should match: ${describe(fixture)}`);
    else if (last.ruleId !== rule.doc.id || last.severity !== rule.severity) {
      failures.push(`fired with the wrong id/severity: ${describe(fixture)}`);
    }
  }
  for (const fixture of rule.doc.tests.nomatch) {
    if ((await run(fixture)).some(Boolean)) failures.push(`should not match: ${describe(fixture)}`);
  }
  return failures;
}
