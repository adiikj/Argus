import { describe, it, expect } from 'vitest';
import { clampDays, triageTimestamps } from '../../src/incident/index.js';

const now = new Date('2026-10-18T09:00:00.000Z');
const earlier = new Date('2026-10-18T08:00:00.000Z');

describe('triageTimestamps', () => {
  it('stamps the first acknowledgement', () => {
    expect(triageTimestamps({ acknowledgedAt: null }, 'acknowledged', now)).toEqual({
      acknowledgedAt: now,
    });
  });

  it('counts closing straight from open as the acknowledgement too', () => {
    expect(triageTimestamps({ acknowledgedAt: null }, 'false_positive', now)).toEqual({
      acknowledgedAt: now,
      closedAt: now,
    });
  });

  it('keeps the original acknowledgement on a later close', () => {
    expect(triageTimestamps({ acknowledgedAt: earlier }, 'resolved', now)).toEqual({
      closedAt: now,
    });
  });

  it('clears the close on reopen so the next close is measured', () => {
    expect(triageTimestamps({ acknowledgedAt: earlier }, 'open', now)).toEqual({
      closedAt: null,
    });
  });
});

describe('clampDays', () => {
  it.each([
    [undefined, 30],
    ['', 30],
    ['junk', 30],
    ['0', 30],
    ['-5', 30],
    ['7', 7],
    ['7.9', 7],
    ['365', 90],
  ])('%s -> %d', (raw, expected) => expect(clampDays(raw)).toBe(expected));
});
