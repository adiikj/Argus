import { describe, it, expect } from 'vitest';
import { RawLog } from '@argus/contracts';
import { benignEvent, SCENARIOS, SCENARIO_NAMES } from '../src/scenarios.js';

describe('benignEvent', () => {
  it('always produces a schema-valid raw log', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(() => RawLog.parse(benignEvent())).not.toThrow();
    }
  });
});

describe('scenario injectors', () => {
  it('exposes the five §15 attack scenarios', () => {
    expect(SCENARIO_NAMES).toEqual(
      expect.arrayContaining(['brute-force', 'sqli', 'dir-enum', 'rate-abuse', 'invalid-jwt']),
    );
  });

  for (const name of SCENARIO_NAMES) {
    it(`${name} emits a non-empty burst of valid raw logs`, () => {
      const logs = SCENARIOS[name]!.generate();
      expect(logs.length).toBeGreaterThan(0);
      for (const log of logs) expect(() => RawLog.parse(log)).not.toThrow();
    });
  }

  it('brute-force emits enough failures to trip the detection threshold', () => {
    const failures = SCENARIOS['brute-force']!.generate().filter((log) =>
      log.message.startsWith('Failed password'),
    );
    expect(failures.length).toBeGreaterThanOrEqual(5);
  });
});
