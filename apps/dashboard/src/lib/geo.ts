// Every attacker IP in this system comes from the generator's synthetic
// traffic, deliberately drawn from IANA-reserved TEST-NET ranges (198.51.100.0/24
// etc — see apps/generator/src/scenarios.ts) so nothing here is a real address.
// A real geo-IP lookup against them would return nothing meaningful (reserved
// ranges have no location) or fail outright. Instead this deterministically
// hashes each IP to one of a fixed, globally-spread set of cities — same IP
// always lands on the same pin, so the map is stable across reloads, without
// pretending to be real geolocation. The UI labels this as simulated.
export interface GeoPoint {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

const CITIES: GeoPoint[] = [
  { city: 'New York', country: 'US', lat: 40.71, lng: -74.01 },
  { city: 'Toronto', country: 'CA', lat: 43.65, lng: -79.38 },
  { city: 'Mexico City', country: 'MX', lat: 19.43, lng: -99.13 },
  { city: 'São Paulo', country: 'BR', lat: -23.55, lng: -46.63 },
  { city: 'Buenos Aires', country: 'AR', lat: -34.6, lng: -58.38 },
  { city: 'Lima', country: 'PE', lat: -12.05, lng: -77.04 },
  { city: 'London', country: 'GB', lat: 51.51, lng: -0.13 },
  { city: 'Berlin', country: 'DE', lat: 52.52, lng: 13.4 },
  { city: 'Warsaw', country: 'PL', lat: 52.23, lng: 21.01 },
  { city: 'Bucharest', country: 'RO', lat: 44.43, lng: 26.1 },
  { city: 'Moscow', country: 'RU', lat: 55.75, lng: 37.62 },
  { city: 'Kyiv', country: 'UA', lat: 50.45, lng: 30.52 },
  { city: 'Lagos', country: 'NG', lat: 6.52, lng: 3.38 },
  { city: 'Cairo', country: 'EG', lat: 30.04, lng: 31.24 },
  { city: 'Nairobi', country: 'KE', lat: -1.29, lng: 36.82 },
  { city: 'Johannesburg', country: 'ZA', lat: -26.2, lng: 28.05 },
  { city: 'Tehran', country: 'IR', lat: 35.69, lng: 51.39 },
  { city: 'Dubai', country: 'AE', lat: 25.2, lng: 55.27 },
  { city: 'Mumbai', country: 'IN', lat: 19.08, lng: 72.88 },
  { city: 'Karachi', country: 'PK', lat: 24.86, lng: 67.01 },
  { city: 'Jakarta', country: 'ID', lat: -6.2, lng: 106.85 },
  { city: 'Bangkok', country: 'TH', lat: 13.76, lng: 100.5 },
  { city: 'Manila', country: 'PH', lat: 14.6, lng: 120.98 },
  { city: 'Tokyo', country: 'JP', lat: 35.68, lng: 139.65 },
  { city: 'Seoul', country: 'KR', lat: 37.57, lng: 126.98 },
  { city: 'Sydney', country: 'AU', lat: -33.87, lng: 151.21 },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function geoForIp(ip: string): GeoPoint {
  return CITIES[hashString(ip) % CITIES.length]!;
}
