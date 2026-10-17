'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GeoPoint, Severity } from '@argus/contracts';
import { useRealtime, type IncidentRow } from '@/lib/realtime';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WORLD_DOTS, WORLD_VIEWBOX } from '@/lib/world-dots';

// local ordering instead of @argus/contracts' SEVERITY_RANK: importing a value
// from the contracts entry pulls all of Zod into the browser bundle
const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
const rank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

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

// same equirectangular projection the dot map was generated with (world-dots.ts)
const { width: W, height: H, latTop, latBottom } = WORLD_VIEWBOX;
function project(lat: number, lng: number): { x: number; y: number } {
  const clamped = Math.min(latTop, Math.max(latBottom, lat));
  return { x: ((lng + 180) / 360) * W, y: ((latTop - clamped) / (latTop - latBottom)) * H };
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

function pinKey(geo: GeoPoint): string {
  return `${geo.source}:${geo.country}:${geo.city ?? ''}`;
}

function arcPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const mx = (from.x + to.x) / 2;
  const my =
    (from.y + to.y) / 2 - Math.min(120, Math.hypot(to.x - from.x, to.y - from.y) * 0.3 + 20);
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
    // locations come resolved from the api (apps/api/src/geo); rows without
    // one (private / unknown addresses) simply get no pin
    const byCity = new Map<string, Pin>();
    for (const { incident, geo } of incidents) {
      if (!geo) continue;
      const key = pinKey(geo);
      const existing = byCity.get(key);
      if (existing) {
        existing.count += 1;
        if (rank(incident.severity) > rank(existing.severity)) {
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
      const spawned = newRows.flatMap((row) =>
        row.geo
          ? [
              {
                id: `${row.incident.incidentId}-${Date.now()}`,
                from: project(row.geo.lat, row.geo.lng),
                color: SEVERITY_VAR[row.incident.severity],
              },
            ]
          : [],
      );
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
  const realPins = pins.filter((p) => p.source === 'dbip').length;
  const simulatedPins = pins.length - realPins;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attacker origins</CardTitle>
        <CardDescription>
          {pins.length === 0
            ? 'Where incidents originate.'
            : `${realPins} real (GeoIP, country level) · ${simulatedPins} simulated (demo traffic from documentation IP ranges)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="relative w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-base/60"
          style={{ aspectRatio: `${W} / ${H}` }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
            <defs>
              <radialGradient id="pin-glow">
                <stop offset="0%" stopColor="white" stopOpacity={0.55} />
                <stop offset="100%" stopColor="white" stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* land as a dot matrix */}
            <path
              d={WORLD_DOTS}
              stroke="var(--color-text-secondary)"
              strokeOpacity={0.32}
              strokeWidth={3.4}
              strokeLinecap="round"
              fill="none"
            />

            <AnimatePresence>
              {arcs.map((arc) => (
                <motion.path
                  key={arc.id}
                  d={arcPath(arc.from, target)}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    pathLength: { duration: 0.9, ease: 'easeOut' },
                    opacity: { duration: ARC_LIFETIME_MS / 1000, times: [0, 0.6, 1] },
                  }}
                />
              ))}
            </AnimatePresence>

            {pins.map((pin) => {
              const { x, y } = project(pin.lat, pin.lng);
              const r = 4.5 + (pin.count / maxCount) * 6;
              const color = SEVERITY_VAR[pin.severity];
              return (
                <g key={pinKey(pin)}>
                  <title>
                    {`${pin.city ? `${pin.city}, ` : ''}${pin.countryName}${pin.source === 'simulated' ? ' (simulated)' : ''} — ${pin.count} incident${pin.count === 1 ? '' : 's'} (${pin.severity})`}
                  </title>
                  <circle cx={x} cy={y} r={r * 2.6} fill={color} opacity={0.12} />
                  {pin.source === 'dbip' ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={color}
                      stroke="var(--color-bg-base)"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill="var(--color-bg-base)"
                      stroke={color}
                      strokeWidth={2.2}
                    />
                  )}
                </g>
              );
            })}

            {/* Argus — where every arc lands */}
            <g>
              <title>Argus — monitored infrastructure</title>
              <motion.circle
                key={pulse}
                cx={target.x}
                cy={target.y}
                r={9}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                initial={{ scale: 1, opacity: 0.9 }}
                animate={pulse > 0 ? { scale: [1, 2.2], opacity: [0.9, 0] } : {}}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                style={{ transformOrigin: `${target.x}px ${target.y}px` }}
              />
              <rect
                x={target.x - 5}
                y={target.y - 5}
                width={10}
                height={10}
                rx={2.5}
                fill="var(--color-bg-base)"
                stroke="var(--color-accent)"
                strokeWidth={2.2}
              />
            </g>
          </svg>
          {pins.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
              No incidents yet.
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-text-secondary">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-text-secondary" /> real
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full border border-text-secondary" />{' '}
              simulated
            </span>
          </span>
          {/* DB-IP Lite is CC BY 4.0 — attribution required wherever it's used */}
          <a
            href="https://db-ip.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary"
          >
            IP Geolocation by DB-IP
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
