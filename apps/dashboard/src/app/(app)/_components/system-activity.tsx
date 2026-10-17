'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRealtime, type PipelineStage } from '@/lib/realtime';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STAGE_COLOR: Record<PipelineStage, string> = {
  parser: 'text-text-secondary',
  detection: 'text-severity-high',
  incident: 'text-accent',
  ai: 'text-severity-low',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export function SystemActivity() {
  const { pipelineActivity } = useRealtime();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <CardTitle>System activity</CardTitle>
          <CardDescription>Stage-by-stage events for attacking sources</CardDescription>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
      </CardHeader>
      <div className="max-h-64 overflow-y-auto px-5 py-3 font-mono text-[11.5px]">
        {pipelineActivity.length === 0 ? (
          <p className="py-8 text-center text-text-muted">Waiting for pipeline activity…</p>
        ) : (
          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {pipelineActivity.map((entry) => (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline gap-2"
                >
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={cn('shrink-0 uppercase', STAGE_COLOR[entry.stage])}>
                    {entry.stage}
                  </span>
                  <span className="shrink-0 truncate text-text-primary">{entry.entity}</span>
                  <span className="truncate text-text-secondary">— {entry.label}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Card>
  );
}
