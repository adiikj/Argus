import { describe, expect, it } from 'vitest';
import { createLogger } from '@argus/logger';
import { createGeoLocator, createGeoLocatorFrom } from '../../src/geo/index.js';

const fakeDb = createGeoLocatorFrom((ip) => ({ '8.8.8.8': 'US', '2a00:1450::1': 'DE' })[ip]);

describe('geo locator', () => {
  it('pins a real public IP at its country centroid', () => {
    expect(fakeDb.locate('8.8.8.8')).toMatchObject({
      country: 'US',
      countryName: 'United States',
      source: 'dbip',
    });
    expect(fakeDb.locate('2a00:1450::1')).toMatchObject({ country: 'DE', source: 'dbip' });
  });

  it('gives documentation-range (demo) IPs a stable, labeled simulated location', () => {
    for (const ip of ['198.51.100.7', '203.0.113.9', '192.0.2.1', '2001:db8::5']) {
      const first = fakeDb.locate(ip);
      expect(first?.source).toBe('simulated');
      expect(fakeDb.locate(ip)).toEqual(first); // same IP, same pin
    }
  });

  it.each(['10.0.0.1', '172.20.1.1', '192.168.1.1', '127.0.0.1', '100.64.0.1', '::1', 'fd00::1'])(
    'never pins private/internal %s',
    (ip) => expect(fakeDb.locate(ip)).toBeNull(),
  );

  it('returns null for non-IP entities and unknown countries', () => {
    expect(fakeDb.locate('user:alice')).toBeNull();
    expect(fakeDb.locate('9.9.9.9')).toBeNull(); // fake db has no entry
  });

  it('still places demo IPs with no database at all', () => {
    const none = createGeoLocatorFrom(undefined);
    expect(none.backend).toBe('none');
    expect(none.locate('8.8.8.8')).toBeNull();
    expect(none.locate('198.51.100.7')?.source).toBe('simulated');
  });

  it('degrades to no lookups when the database file is missing', () => {
    const geo = createGeoLocator('/nonexistent.mmdb', createLogger({ level: 'fatal' }));
    expect(geo.backend).toBe('none');
  });

  // real DB-IP file, when one is around (the api image ships it; CI doesn't):
  //   GEOIP_TEST_DB=/path/dbip-country-lite.mmdb pnpm test
  it.skipIf(!process.env.GEOIP_TEST_DB)('resolves real addresses from a real database', () => {
    const geo = createGeoLocator(process.env.GEOIP_TEST_DB, createLogger({ level: 'fatal' }));
    expect(geo.backend).toBe('dbip');
    expect(geo.locate('8.8.8.8')?.country).toBe('US');
  });
});
