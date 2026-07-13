import { describe, it, expect } from 'vitest';
import type { IncidentStatus } from '@argus/contracts';
import { canTransition } from '../../src/incident/transitions.js';

describe('canTransition', () => {
  const valid: Array<[IncidentStatus, IncidentStatus]> = [
    ['open', 'acknowledged'],
    ['open', 'resolved'],
    ['open', 'false_positive'],
    ['acknowledged', 'resolved'],
    ['acknowledged', 'false_positive'],
    ['acknowledged', 'open'],
    ['resolved', 'open'],
    ['false_positive', 'open'],
  ];

  const invalid: Array<[IncidentStatus, IncidentStatus]> = [
    ['open', 'open'],
    ['resolved', 'acknowledged'],
    ['resolved', 'resolved'],
    ['resolved', 'false_positive'],
    ['false_positive', 'acknowledged'],
    ['false_positive', 'resolved'],
    ['false_positive', 'false_positive'],
    ['acknowledged', 'acknowledged'],
  ];

  it.each(valid)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(invalid)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
