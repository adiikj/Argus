'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Alert, Incident, IncidentSummary } from '@argus/contracts';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4100/ws';
export const API_URL = WS_URL.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws$/, '');

export interface IncidentRow {
  incident: Incident;
  latestAlert: Alert;
}

type WsMessage =
  | { type: 'incident.created' | 'incident.updated'; incident: Incident; latestAlert: Alert }
  | { type: 'summary.ready'; summary: IncidentSummary };

interface RealtimeState {
  incidents: IncidentRow[];
  summaries: Record<string, IncidentSummary>;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeState | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, IncidentSummary>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => setConnected(true));
    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data as string) as WsMessage;

      if (payload.type === 'summary.ready') {
        setSummaries((prev) => ({ ...prev, [payload.summary.incidentId]: payload.summary }));
        return;
      }

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
    return () => socket.close();
  }, []);

  return (
    <RealtimeContext.Provider value={{ incidents, summaries, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within a RealtimeProvider');
  return ctx;
}
