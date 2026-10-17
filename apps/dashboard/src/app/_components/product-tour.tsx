'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

// screens of the console, cycling on their own until the visitor picks one
const SCREENS = [
  {
    key: 'overview',
    label: 'Overview',
    caption: 'Throughput, severity and where attacks come from.',
  },
  {
    key: 'alerts',
    label: 'Alerts',
    caption: 'Incidents as they form. Ask for them in plain English.',
  },
  { key: 'incident', label: 'Incident', caption: 'Summary, kill chain, threat intel and triage.' },
  { key: 'coverage', label: 'Coverage', caption: 'Every rule with its ATT&CK technique.' },
  {
    key: 'simulator',
    label: 'Simulator',
    caption: 'Fire a scenario and follow it through the pipeline.',
  },
  { key: 'logs', label: 'Logs', caption: 'Search every event and trace it end to end.' },
];

const ADVANCE_MS = 6000;

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(true);
  const screen = SCREENS[active]!;

  useEffect(() => {
    if (!auto || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % SCREENS.length), ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, auto, paused]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        className="mt-10 flex gap-1 overflow-x-auto border-b border-border-subtle"
        role="tablist"
      >
        {SCREENS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
              className={`relative shrink-0 px-3.5 pt-1 pb-3 text-[13.5px] transition-colors ${
                on ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {s.label}
              {on && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] overflow-hidden bg-border-strong">
                  <span
                    key={`${active}-${auto}`}
                    className="block h-full origin-left bg-accent"
                    style={
                      auto
                        ? {
                            animation: `tour-progress ${ADVANCE_MS}ms linear forwards`,
                            animationPlayState: paused ? 'paused' : 'running',
                          }
                        : undefined
                    }
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-5 min-h-[22px] text-[14.5px] text-text-secondary">{screen.caption}</p>

      <div className="mt-5 overflow-hidden rounded-[var(--radius-panel)] border border-border-strong bg-bg-panel">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2 w-2 rounded-full border border-border-strong" />
            <span className="h-2 w-2 rounded-full border border-border-strong" />
            <span className="h-2 w-2 rounded-full border border-border-strong" />
          </span>
          <span className="rounded-[4px] border border-border-subtle bg-bg-base px-2.5 py-0.5 font-mono text-[11px] text-text-muted">
            argus.buzz/{screen.key === 'incident' ? 'incidents/7f3a' : screen.key}
          </span>
        </div>
        <div className="relative aspect-[16/10] bg-bg-base">
          <AnimatePresence initial={false}>
            <motion.div
              key={screen.key}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Image
                src={`/tour/${screen.key}.webp`}
                alt={`The Argus ${screen.label.toLowerCase()} screen`}
                fill
                sizes="(min-width: 1152px) 1104px, 100vw"
                className="object-cover object-top"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
