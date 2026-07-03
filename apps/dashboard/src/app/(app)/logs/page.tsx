'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents } from '@/lib/use-events';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const SOURCES = ['auth', 'nginx', 'api-gateway'] as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}

export default function LogsPage() {
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const {
    data: events,
    isLoading,
    isError,
  } = useEvents({
    q: q || undefined,
    source: source || undefined,
    limit: 100,
  });

  const toggle = (eventId: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-lg font-semibold text-text-primary">Log Explorer</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Search the normalized event stream. Click a row to trace it through the pipeline.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search raw text, ip, path, user agent…"
          className="flex-1 rounded-md border border-border-subtle bg-bg-panel px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent/50 focus:outline-none"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border border-border-subtle bg-bg-panel px-3 py-1.5 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
        >
          <option value="">all sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton className="h-4 w-14 shrink-0" />
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24 shrink-0" />
              </li>
            ))}
          </ul>
        </Card>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-subtle py-24 text-center">
          <p className="text-sm text-text-secondary">
            Couldn&apos;t reach the api — search is unavailable right now.
          </p>
        </div>
      ) : events && events.length > 0 ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {events.map((event, i) => {
              const isOpen = expanded.has(event.eventId);
              return (
                <motion.li
                  key={event.eventId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(i, 20) * 0.012 }}
                >
                  <div className="flex items-center gap-1 px-2 py-1 text-sm transition-colors hover:bg-bg-elevated">
                    <button
                      type="button"
                      onClick={() => toggle(event.eventId)}
                      className="flex flex-1 items-center gap-3 rounded px-2 py-1.5 text-left"
                    >
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 shrink-0 text-text-secondary transition-transform',
                          isOpen && 'rotate-90',
                        )}
                      />
                      <span className="shrink-0 rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] uppercase text-text-secondary">
                        {event.source}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-secondary">
                        {event.sourceIp}
                      </span>
                      <span className="flex-1 truncate font-mono text-xs text-text-primary">
                        {event.raw}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-secondary tabular-nums">
                        {formatTime(event.timestamp)}
                      </span>
                    </button>
                    <Link
                      href={`/logs/${event.eventId}`}
                      title="View trace"
                      className="shrink-0 rounded p-1.5 text-text-secondary transition-colors hover:text-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {isOpen && (
                    <pre className="overflow-x-auto border-t border-border-subtle bg-bg-elevated px-4 py-3 font-mono text-[11px] text-text-secondary">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-subtle py-24 text-center">
          <p className="text-sm text-text-secondary">No events match.</p>
        </div>
      )}
    </main>
  );
}
