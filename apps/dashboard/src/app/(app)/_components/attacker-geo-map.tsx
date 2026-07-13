'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SEVERITY_RANK, type Severity } from '@argus/contracts';
import { useRealtime, type IncidentRow } from '@/lib/realtime';
import { geoForIp, type GeoPoint } from '@/lib/geo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

// a single fixed point standing in for "us" — arcs converge on it. Not a real
// place any more than the attacker pins are; labeled plainly via title.
const TARGET = { lat: 39, lng: -95 };

const SEVERITY_VAR: Record<Severity, string> = {
  critical: 'var(--color-severity-critical)',
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
  info: 'var(--color-severity-info)',
};

const ARC_LIFETIME_MS = 3800;
const MAX_ARCS = 15;

function project(lat: number, lng: number): { x: number; y: number } {
  return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

interface Pin extends GeoPoint {
  count: number;
  severity: Severity;
}

interface Arc {
  id: string;
  from: { x: number; y: number };
  color: string;
}

function arcPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 - Math.min(20, Math.abs(to.x - from.x) * 0.25 + 6);
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

export function AttackerGeoMap() {
  const { incidents } = useRealtime();
  const [pins, setPins] = useState<Pin[]>([]);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [pulse, setPulse] = useState(0);
  const seenIds = useRef<Set<string> | undefined>(undefined);

  useEffect(() => {
    if (incidents.length === 0) return;

    const isFirstPopulation = seenIds.current === undefined;
    const seen = seenIds.current ?? new Set<string>();
    const newRows: IncidentRow[] = [];

    for (const row of incidents) {
      if (!seen.has(row.incident.incidentId)) {
        seen.add(row.incident.incidentId);
        if (!isFirstPopulation) newRows.push(row);
      }
    }
    seenIds.current = seen;

    // recompute the aggregate pins from the full current list every time —
    // cheap at this scale and keeps counts/severity always in sync.
    const byCity = new Map<string, Pin>();
    for (const { incident } of incidents) {
      const geo = geoForIp(incident.correlationKey);
      const key = `${geo.city}-${geo.country}`;
      const existing = byCity.get(key);
      if (existing) {
        existing.count += 1;
        if (SEVERITY_RANK[incident.severity] > SEVERITY_RANK[existing.severity]) {
          existing.severity = incident.severity;
        }
      } else {
        byCity.set(key, { ...geo, count: 1, severity: incident.severity });
      }
    }
    setPins([...byCity.values()]);

    // only incidents that arrived after the initial backfill get an animated
    // arc — otherwise the 50-incident history backfill would fire a burst of
    // arcs the instant the page loads.
    if (newRows.length > 0) {
      const spawned = newRows.map((row) => {
        const geo = geoForIp(row.incident.correlationKey);
        return {
          id: `${row.incident.incidentId}-${Date.now()}`,
          from: project(geo.lat, geo.lng),
          color: SEVERITY_VAR[row.incident.severity],
        };
      });
      setArcs((prev) => [...prev, ...spawned].slice(-MAX_ARCS));
      setPulse((p) => p + 1);
      for (const arc of spawned) {
        setTimeout(() => {
          setArcs((prev) => prev.filter((a) => a.id !== arc.id));
        }, ARC_LIFETIME_MS);
      }
    }
  }, [incidents]);

  const maxCount = Math.max(1, ...pins.map((p) => p.count));
  const target = project(TARGET.lat, TARGET.lng);

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

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <AnimatePresence>
                {arcs.map((arc) => (
                  <motion.path
                    key={arc.id}
                    d={arcPath(arc.from, target)}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                    initial={{ pathLength: 0, opacity: 1 }}
                    animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{
                      pathLength: { duration: 0.8, ease: 'easeOut' },
                      opacity: { duration: ARC_LIFETIME_MS / 1000, times: [0, 0.6, 1] },
                    }}
                  />
                ))}
              </AnimatePresence>
            </svg>

            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              title="Argus — monitored infrastructure"
            >
              <motion.span
                key={pulse}
                animate={pulse > 0 ? { scale: [1, 1.6, 1] } : {}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="block h-3 w-3 rounded-sm border-2 border-accent bg-bg-elevated"
              />
            </div>

            {pins.map((pin) => {
              const { x, y } = project(pin.lat, pin.lng);
              const size = 6 + (pin.count / maxCount) * 10;
              return (
                <div
                  key={`${pin.city}-${pin.country}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${pin.city}, ${pin.country} — ${pin.count} incident${pin.count === 1 ? '' : 's'} (${pin.severity})`}
                >
                  <span
                    className="block animate-pulse rounded-full"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: SEVERITY_VAR[pin.severity],
                      opacity: 0.75,
                    }}
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
