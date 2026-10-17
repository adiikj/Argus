import type { GeoPoint } from '@argus/contracts';

// The demo's synthetic attackers come from IANA documentation ranges
// (TEST-NET-1/2/3, 2001:db8::/32) so nothing in the simulator is a real
// address — and documentation ranges have no real location. For those, a
// deterministic hash picks one of a fixed, globally spread set of cities: the
// same IP always lands on the same pin, and the result is flagged `simulated`
// so the UI says so. Real addresses never come through here.
const CITIES: Array<Omit<GeoPoint, 'source'>> = [
  { city: 'New York', country: 'US', countryName: 'United States', lat: 40.71, lng: -74.01 },
  { city: 'Toronto', country: 'CA', countryName: 'Canada', lat: 43.65, lng: -79.38 },
  { city: 'Mexico City', country: 'MX', countryName: 'Mexico', lat: 19.43, lng: -99.13 },
  { city: 'São Paulo', country: 'BR', countryName: 'Brazil', lat: -23.55, lng: -46.63 },
  { city: 'Buenos Aires', country: 'AR', countryName: 'Argentina', lat: -34.6, lng: -58.38 },
  { city: 'Lima', country: 'PE', countryName: 'Peru', lat: -12.05, lng: -77.04 },
  { city: 'London', country: 'GB', countryName: 'United Kingdom', lat: 51.51, lng: -0.13 },
  { city: 'Berlin', country: 'DE', countryName: 'Germany', lat: 52.52, lng: 13.4 },
  { city: 'Warsaw', country: 'PL', countryName: 'Poland', lat: 52.23, lng: 21.01 },
  { city: 'Bucharest', country: 'RO', countryName: 'Romania', lat: 44.43, lng: 26.1 },
  { city: 'Moscow', country: 'RU', countryName: 'Russia', lat: 55.75, lng: 37.62 },
  { city: 'Kyiv', country: 'UA', countryName: 'Ukraine', lat: 50.45, lng: 30.52 },
  { city: 'Lagos', country: 'NG', countryName: 'Nigeria', lat: 6.52, lng: 3.38 },
  { city: 'Cairo', country: 'EG', countryName: 'Egypt', lat: 30.04, lng: 31.24 },
  { city: 'Nairobi', country: 'KE', countryName: 'Kenya', lat: -1.29, lng: 36.82 },
  { city: 'Johannesburg', country: 'ZA', countryName: 'South Africa', lat: -26.2, lng: 28.05 },
  { city: 'Tehran', country: 'IR', countryName: 'Iran', lat: 35.69, lng: 51.39 },
  { city: 'Dubai', country: 'AE', countryName: 'United Arab Emirates', lat: 25.2, lng: 55.27 },
  { city: 'Mumbai', country: 'IN', countryName: 'India', lat: 19.08, lng: 72.88 },
  { city: 'Karachi', country: 'PK', countryName: 'Pakistan', lat: 24.86, lng: 67.01 },
  { city: 'Jakarta', country: 'ID', countryName: 'Indonesia', lat: -6.2, lng: 106.85 },
  { city: 'Bangkok', country: 'TH', countryName: 'Thailand', lat: 13.76, lng: 100.5 },
  { city: 'Manila', country: 'PH', countryName: 'Philippines', lat: 14.6, lng: 120.98 },
  { city: 'Tokyo', country: 'JP', countryName: 'Japan', lat: 35.68, lng: 139.65 },
  { city: 'Seoul', country: 'KR', countryName: 'South Korea', lat: 37.57, lng: 126.98 },
  { city: 'Sydney', country: 'AU', countryName: 'Australia', lat: -33.87, lng: 151.21 },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function simulatedGeo(ip: string): GeoPoint {
  return { ...CITIES[hashString(ip) % CITIES.length]!, source: 'simulated' };
}
