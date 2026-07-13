'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Alert,
  Incident,
  IncidentSummary,
  NormalizedEvent,
  RecentActivity,
} from '@argus/contracts';
import { authFetch, getToken } from './auth';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4100/ws';
export const API_URL = WS_URL.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws$/, '');

export interface IncidentRow {
  incident: Incident;
  latestAlert: Alert;
}

export type PipelineStage = 'parser' | 'detection' | 'incident' | 'ai';

export interface PipelineActivity {
  id: string;
  stage: PipelineStage;
  entity: string;
  label: string;
  timestamp: string;
}

type WsMessage =
  | { type: 'incident.created' | 'incident.updated'; incident: Incident; latestAlert: Alert }
  | { type: 'incident.status_changed'; incident: Incident }
  | { type: 'summary.ready'; summary: IncidentSummary }
  | { type: 'event.normalized'; event: NormalizedEvent }
  | { type: 'alert.raised'; alert: Alert };

interface RealtimeState {
  incidents: IncidentRow[];
  summaries: Record<string, IncidentSummary>;
  connected: boolean;
  pipelineActivity: PipelineActivity[];
  ruleCounts: Record<string, number>;
  // alerts per hour-of-day (0-23) — seeded from all-time history via GET
  // /incidents on mount, then incremented live as new alerts arrive.
  hourlyActivity: number[];
}

const RealtimeContext = createContext<RealtimeState | undefined>(undefined);

const MAX_ACTIVITY = 50;

function emptyHours(): number[] {
  return Array.from({ length: 24 }, () => 0);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, IncidentSummary>>({});
  const [connected, setConnected] = useState(false);
  const [pipelineActivity, setPipelineActivity] = useState<PipelineActivity[]>([]);
  const [ruleCounts, setRuleCounts] = useState<Record<string, number>>({});
  const [hourlyActivity, setHourlyActivity] = useState<number[]>(emptyHours);
  const activityCounter = useRef(0);

  // backfill from Postgres on mount — otherwise a freshly opened tab stays
  // empty until new events happen to arrive live over the socket, even though
  // there may be days of history already sitting in the database.
  useEffect(() => {
    let cancelled = false;
    authFetch(`${API_URL}/incidents`)
      .then((res) => (res.ok ? (res.json() as Promise<RecentActivity>) : undefined))
      .then((data) => {
        if (cancelled || !data) return;
        setIncidents((prev) =>
          prev.length > 0
            ? prev
            : data.incidents.map(({ incident, latestAlert }) => ({ incident, latestAlert })),
        );
        setRuleCounts((prev) => (Object.keys(prev).length > 0 ? prev : data.ruleCounts));
        setHourlyActivity((prev) => (prev.some((n) => n > 0) ? prev : data.hourlyActivity));
      })
      .catch(() => {
        // no history yet (fresh install) or api unreachable — the live socket
        // is still the source of truth going forward either way.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const connect = (): void => {
      const token = getToken();
      const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
      socket = new WebSocket(url);

      socket.addEventListener('open', () => {
        attempt = 0;
        setConnected(true);
      });

      // a dropped connection (api restart, network blip) otherwise left the
      // badge stuck on "disconnected" forever — nothing ever retried. Capped
      // exponential backoff: 1s, 2s, 4s, ... up to 15s between attempts.
      socket.addEventListener('close', () => {
        setConnected(false);
        if (stopped) return;
        const delay = Math.min(15_000, 1000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      });

      socket.addEventListener('message', (event) => {
        const payload = JSON.parse(event.data as string) as WsMessage;

        const pushActivity = (
          stage: PipelineStage,
          entity: string,
          label: string,
          timestamp: string,
        ): void => {
          activityCounter.current += 1;
          const entry: PipelineActivity = {
            id: `${stage}-${activityCounter.current}`,
            stage,
            entity,
            label,
            timestamp,
          };
          setPipelineActivity((prev) => [entry, ...prev].slice(0, MAX_ACTIVITY));
        };

        if (payload.type === 'event.normalized') {
          pushActivity(
            'parser',
            payload.event.sourceIp,
            `normalized (${payload.event.source})`,
            payload.event.timestamp,
          );
          return;
        }

        if (payload.type === 'alert.raised') {
          pushActivity(
            'detection',
            payload.alert.entity,
            `${payload.alert.ruleId} fired`,
            payload.alert.timestamp,
          );
          setRuleCounts((prev) => ({
            ...prev,
            [payload.alert.ruleId]: (prev[payload.alert.ruleId] ?? 0) + 1,
          }));
          setHourlyActivity((prev) => {
            const hour = new Date(payload.alert.timestamp).getHours();
            const next = [...prev];
            next[hour] = (next[hour] ?? 0) + 1;
            return next;
          });
          return;
        }

        if (payload.type === 'incident.status_changed') {
          queryClient.invalidateQueries({ queryKey: ['incident', payload.incident.incidentId] });
          pushActivity(
            'incident',
            payload.incident.correlationKey,
            `status → ${payload.incident.status}`,
            payload.incident.updatedAt,
          );
          setIncidents((prev) =>
            prev.map((row) =>
              row.incident.incidentId === payload.incident.incidentId
                ? { ...row, incident: payload.incident }
                : row,
            ),
          );
          return;
        }

        if (payload.type === 'summary.ready') {
          setSummaries((prev) => ({ ...prev, [payload.summary.incidentId]: payload.summary }));
          pushActivity(
            'ai',
            payload.summary.incidentId.slice(0, 8),
            'summary generated',
            payload.summary.generatedAt,
          );
          return;
        }

        pushActivity(
          'incident',
          payload.incident.correlationKey,
          payload.type === 'incident.created' ? 'incident opened' : 'incident updated',
          payload.incident.updatedAt,
        );

        setIncidents((prev) => {
          const withoutPrior = prev.filter(
            (row) => row.incident.incidentId !== payload.incident.incidentId,
          );
          const next = [
            { incident: payload.incident, latestAlert: payload.latestAlert },
            ...withoutPrior,
          ];
          next.sort(
            (a, b) =>
              new Date(b.incident.updatedAt).getTime() - new Date(a.incident.updatedAt).getTime(),
          );
          return next.slice(0, 200);
        });
      });
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{ incidents, summaries, connected, pipelineActivity, ruleCounts, hourlyActivity }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within a RealtimeProvider');
  return ctx;
}
