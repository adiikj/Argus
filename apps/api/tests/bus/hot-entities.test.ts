import { describe, it, expect } from 'vitest';
import { HotEntities } from '../../src/bus/index.js';

describe('HotEntities', () => {
  it('is not hot before being marked', () => {
    const hot = new HotEntities(1000);
    expect(hot.isHot('198.51.100.1', 0)).toBe(false);
  });

  it('is hot immediately after being marked', () => {
    const hot = new HotEntities(1000);
    hot.markHot('198.51.100.1', 0);
    expect(hot.isHot('198.51.100.1', 500)).toBe(true);
  });

  it('cools down once the ttl elapses', () => {
    const hot = new HotEntities(1000);
    hot.markHot('198.51.100.1', 0);
    expect(hot.isHot('198.51.100.1', 1500)).toBe(false);
  });

  it('keeps entities independent', () => {
    const hot = new HotEntities(1000);
    hot.markHot('198.51.100.1', 0);
    expect(hot.isHot('198.51.100.2', 0)).toBe(false);
  });

  it('refreshes the ttl on a repeated mark', () => {
    const hot = new HotEntities(1000);
    hot.markHot('198.51.100.1', 0);
    hot.markHot('198.51.100.1', 900);
    expect(hot.isHot('198.51.100.1', 1500)).toBe(true);
  });
});
