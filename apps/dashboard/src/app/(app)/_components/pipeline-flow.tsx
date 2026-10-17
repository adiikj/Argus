'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Radio,
  Boxes,
  FileCode2,
  ShieldAlert,
  GitMerge,
  Sparkles,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react';
import { useRealtime, type PipelineStage } from '@/lib/realtime';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const NODES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'generator', label: 'Generator', icon: Radio },
  { key: 'kafka', label: 'Kafka', icon: Boxes },
  { key: 'parser', label: 'Parser', icon: FileCode2 },
  { key: 'detection', label: 'Detection', icon: ShieldAlert },
  { key: 'incident', label: 'Incident', icon: GitMerge },
  { key: 'ai', label: 'AI Summary', icon: Sparkles },
  { key: 'dashboard', label: 'Dashboard', icon: MonitorSmartphone },
];

const STAGES_FOR_ACTIVITY: Record<PipelineStage, string[]> = {
  parser: ['generator', 'kafka', 'parser'],
  detection: ['detection'],
  incident: ['incident'],
  ai: ['ai'],
};

const STEP_DELAY_MS = 120;

export function PipelineFlow() {
  const { pipelineActivity } = useRealtime();
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const seenId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const latest = pipelineActivity[0];
    if (!latest || latest.id === seenId.current) return;
    seenId.current = latest.id;

    const stages = STAGES_FOR_ACTIVITY[latest.stage];
    stages.forEach((stage, i) => {
      setTimeout(() => {
        setPulses((prev) => ({ ...prev, [stage]: (prev[stage] ?? 0) + 1 }));
      }, i * STEP_DELAY_MS);
    });
    setTimeout(
      () => setPulses((prev) => ({ ...prev, dashboard: (prev.dashboard ?? 0) + 1 })),
      (stages.length + 1) * STEP_DELAY_MS,
    );
  }, [pipelineActivity]);

  return (
    <Card className="overflow-x-auto">
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[13px] font-medium tracking-tight">Live pipeline</span>
        <span className="font-mono text-[10.5px] text-text-muted">
          raw log → explained incident
        </span>
      </div>
      <div className="flex min-w-[640px] items-center justify-between px-5 pt-5 pb-5">
        {NODES.map((node, i) => (
          <div key={node.key} className="flex flex-1 items-center">
            <Node label={node.label} Icon={node.icon} pulseCount={pulses[node.key] ?? 0} />
            {i < NODES.length - 1 && (
              <div className="relative mx-1 mb-6 h-px flex-1 bg-border-strong sm:mx-2">
                <span
                  className="animate-packet absolute -top-[2px] left-0 h-[5px] w-[5px] bg-accent"
                  style={{ animationDelay: `${i * 0.35}s`, ['--travel' as string]: '80px' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Node({
  label,
  Icon,
  pulseCount,
}: {
  label: string;
  Icon: LucideIcon;
  pulseCount: number;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <motion.span
        key={pulseCount}
        animate={
          pulseCount > 0
            ? {
                scale: [1, 1.18, 1],
                borderColor: [
                  'var(--color-border-subtle)',
                  'var(--color-accent)',
                  'var(--color-border-subtle)',
                ],
              }
            : {}
        }
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-bg-elevated text-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </motion.span>
      <span className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  );
}
