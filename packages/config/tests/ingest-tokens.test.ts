import { describe, expect, it } from 'vitest';
import { IngestTokens } from '../src/index.js';

const token = (c: string) => c.repeat(32);

describe('INGEST_TOKENS', () => {
  it('defaults to none (ingest disabled)', () => {
    expect(IngestTokens.parse(undefined)).toEqual([]);
    expect(IngestTokens.parse(' ')).toEqual([]);
  });

  it('takes a comma list, for rotation', () => {
    expect(IngestTokens.parse(` ${token('a')}, ${token('b')} `)).toEqual([token('a'), token('b')]);
  });

  it('rejects short tokens', () => {
    expect(IngestTokens.safeParse(`${token('a')},short`).success).toBe(false);
  });
});
