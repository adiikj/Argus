import { readFileSync } from 'node:fs';
import { BlockList, isIP } from 'node:net';
import { Reader, type CountryResponse } from 'maxmind';
import type { Logger } from '@argus/logger';
import type { GeoPoint } from '@argus/contracts';
import { COUNTRY_CENTROIDS } from './country-centroids.js';
import { simulatedGeo } from './simulated.js';

// IANA documentation ranges — what the simulator's synthetic attackers use.
// No real location exists for them, so they get a labeled simulated one.
const DOCUMENTATION = new BlockList();
DOCUMENTATION.addSubnet('192.0.2.0', 24, 'ipv4'); // TEST-NET-1
DOCUMENTATION.addSubnet('198.51.100.0', 24, 'ipv4'); // TEST-NET-2
DOCUMENTATION.addSubnet('203.0.113.0', 24, 'ipv4'); // TEST-NET-3
DOCUMENTATION.addSubnet('2001:db8::', 32, 'ipv6');

// private / internal / special-use space — never a meaningful map pin
const NON_PUBLIC = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 3], // multicast + reserved
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 127], // :: and ::1
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, 'ipv6');
}

export type IpClass = 'public' | 'documentation' | 'non-public' | 'invalid';

// shared by GeoIP and threat intel: only 'public' addresses are ever looked
// up — demo (documentation-range) and internal ones never leave the box
export function classifyIp(ip: string): IpClass {
  const family = isIP(ip);
  if (family === 0) return 'invalid';
  const type = family === 4 ? 'ipv4' : 'ipv6';
  if (DOCUMENTATION.check(ip, type)) return 'documentation';
  if (NON_PUBLIC.check(ip, type)) return 'non-public';
  return 'public';
}

export type CountryLookup = (ip: string) => string | undefined; // -> ISO 3166-1 alpha-2

export interface GeoLocator {
  readonly backend: 'dbip' | 'none';
  locate(ip: string): GeoPoint | null;
}

// pure decision over an injected country lookup — what tests exercise
export function createGeoLocatorFrom(lookupCountry: CountryLookup | undefined): GeoLocator {
  return {
    backend: lookupCountry ? 'dbip' : 'none',
    locate(ip) {
      const kind = classifyIp(ip);
      if (kind === 'documentation') return simulatedGeo(ip);
      if (kind !== 'public' || !lookupCountry) return null; // invalid / internal / no DB

      const iso = lookupCountry(ip);
      const centroid = iso ? COUNTRY_CENTROIDS[iso] : undefined;
      if (!iso || !centroid) return null;
      return {
        country: iso,
        countryName: centroid.name,
        lat: centroid.lat,
        lng: centroid.lng,
        source: 'dbip',
      };
    },
  };
}

// Loads DB-IP's free "IP to Country Lite" database (CC BY 4.0 — attribution
// shown on the attack map). Country-level on purpose: the whole file is held
// in memory (~8 MB); the city-level database is ~130 MB, far past the api's
// budget on a small shared VM. No file -> simulated pins only, logged once.
export function createGeoLocator(dbPath: string | undefined, log: Logger): GeoLocator {
  if (!dbPath) {
    log.info('no GEOIP_DB set — real IPs get no map location (simulated demo IPs still do)');
    return createGeoLocatorFrom(undefined);
  }
  try {
    const reader = new Reader<CountryResponse>(readFileSync(dbPath));
    log.info(
      { dbPath, build: new Date(reader.metadata.buildEpoch).toISOString() },
      'GeoIP database loaded',
    );
    return createGeoLocatorFrom((ip) => reader.get(ip)?.country?.iso_code);
  } catch (err) {
    log.warn({ err, dbPath }, 'GeoIP database unreadable — continuing without real lookups');
    return createGeoLocatorFrom(undefined);
  }
}
