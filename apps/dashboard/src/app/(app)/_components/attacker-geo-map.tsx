'use client';

import { useMemo } from 'react';
import { useRealtime } from '@/lib/realtime';
import { geoForIp, type GeoPoint } from '@/lib/geo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

function project(lat: number, lng: number): { x: number; y: number } {
  return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

interface Pin extends GeoPoint {
  count: number;
}

export function AttackerGeoMap() {
  const { incidents } = useRealtime();

  const pins = useMemo(() => {
    const byCity = new Map<string, Pin>();
    for (const { incident } of incidents) {
      const geo = geoForIp(incident.correlationKey);
      const key = `${geo.city}-${geo.country}`;
      const existing = byCity.get(key);
      if (existing) existing.count += 1;
      else byCity.set(key, { ...geo, count: 1 });
    }
    return [...byCity.values()];
  }, [incidents]);

  const maxCount = Math.max(1, ...pins.map((p) => p.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attacker origins</CardTitle>
        <CardDescription>Simulated from demo traffic — not real geolocation.</CardDescription>
      </CardHeader>
      <CardContent>
        {pins.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-text-secondary">
            No incidents yet.
          </div>
        ) : (
          <div className="relative h-56 overflow-hidden rounded-md border border-border-subtle bg-bg-elevated">
            {MERIDIANS.map((lng) => (
              <div
                key={`v-${lng}`}
                className="absolute top-0 bottom-0 w-px bg-border-subtle/40"
                style={{ left: `${project(0, lng).x}%` }}
              />
            ))}
            {PARALLELS.map((lat) => (
              <div
                key={`h-${lat}`}
                className="absolute left-0 right-0 h-px bg-border-subtle/40"
                style={{ top: `${project(lat, 0).y}%` }}
              />
            ))}
            {pins.map((pin) => {
              const { x, y } = project(pin.lat, pin.lng);
              const size = 6 + (pin.count / maxCount) * 10;
              return (
                <div
                  key={`${pin.city}-${pin.country}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${pin.city}, ${pin.country} — ${pin.count} incident${pin.count === 1 ? '' : 's'}`}
                >
                  <span
                    className="block animate-pulse rounded-full bg-severity-critical/70"
                    style={{ width: size, height: size }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
