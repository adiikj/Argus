'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from './utils';

const SEEN_KEY = 'argus_tour_seen';

interface TourStep {
  route: string;
  selector: string;
  title: string;
  body: string;
}

// kept to the three static routes already in the nav — no dynamic
// /incidents/[id] target, so the tour never depends on a real incident
// existing yet.
const TOUR_STEPS: TourStep[] = [
  {
    route: '/overview',
    selector: 'overview-metrics',
    title: 'A live pipeline, not a mockup',
    body: 'Every number here is real — events, alerts, incidents, and AI summaries streaming through the actual running pipeline right now.',
  },
  {
    route: '/overview',
    selector: 'top-attackers',
    title: 'Correlated, not just listed',
    body: 'Related alerts are grouped into incidents and ranked by attacker. Click any row for the full timeline.',
  },
  {
    route: '/simulator',
    selector: 'scenario-cards',
    title: 'Fire a real attack',
    body: 'Launch a scenario — a burst of failed SSH logins, a SQLi probe — straight into the live pipeline.',
  },
  {
    route: '/simulator',
    selector: 'pipeline-flow',
    title: 'Watch it move, stage by stage',
    body: 'Kafka → parser → detection → correlation → AI summarization — each stage lights up as your event passes through it.',
  },
  {
    route: '/alerts',
    selector: 'alerts-feed',
    title: "That's the tour",
    body: 'Here’s the live incident feed. Click through any row for the full AI-written summary and IOCs.',
  },
];

interface TourContextValue {
  active: boolean;
  start: () => void;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}

function waitForElement(selector: string, timeoutMs = 1200): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = (): void => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${selector}"]`);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

const TOOLTIP_WIDTH = 300;
const TOOLTIP_HEIGHT_ESTIMATE = 170;

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | undefined>(undefined);
  const [seen, setSeen] = useState(true); // default hides the banner until we know better (avoids a hydration mismatch)
  const generation = useRef(0);

  useEffect(() => {
    setSeen(window.localStorage.getItem(SEEN_KEY) === '1');
  }, []);

  const markSeen = (): void => {
    window.localStorage.setItem(SEEN_KEY, '1');
    setSeen(true);
  };

  const goToStep = (index: number): void => {
    generation.current += 1;
    setStepIndex(index);
    const step = TOUR_STEPS[index];
    if (step && step.route !== pathname) router.push(step.route);
  };

  const start = (): void => {
    setActive(true);
    goToStep(0);
  };

  const finish = (): void => {
    setActive(false);
    setRect(undefined);
    markSeen();
  };

  const next = (): void => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    goToStep(stepIndex + 1);
  };

  const prev = (): void => {
    if (stepIndex === 0) return;
    goToStep(stepIndex - 1);
  };

  // measure (and re-measure on resize/scroll) the current step's target
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (!step || step.route !== pathname) return;

    const myGeneration = generation.current;
    let cancelled = false;

    const measure = (): void => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.selector}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };

    waitForElement(step.selector).then((el) => {
      if (cancelled || generation.current !== myGeneration) return;
      if (el) setRect(el.getBoundingClientRect());
    });

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, stepIndex, pathname]);

  const step = active ? TOUR_STEPS[stepIndex] : undefined;
  const showBanner = !active && !seen && pathname === '/overview';

  return (
    <TourContext.Provider value={{ active, start }}>
      {children}

      {step && rect && step.route === pathname && (
        <TourHighlight
          rect={rect}
          step={step}
          stepIndex={stepIndex}
          total={TOUR_STEPS.length}
          onNext={next}
          onPrev={prev}
          onSkip={finish}
        />
      )}

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-accent/30 bg-bg-elevated px-4 py-2.5 shadow-2xl shadow-black/40"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} />
            <span className="whitespace-nowrap text-xs text-text-primary">
              New here? Take the 60-second tour.
            </span>
            <Button size="sm" onClick={start}>
              Start
            </Button>
            <button
              type="button"
              onClick={markSeen}
              aria-label="Dismiss"
              className="shrink-0 text-text-secondary transition-colors hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}

function TourHighlight({
  rect,
  step,
  stepIndex,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  rect: DOMRect;
  step: TourStep;
  stepIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const placeBelow = rect.bottom + 12 + TOOLTIP_HEIGHT_ESTIMATE <= window.innerHeight;
  const top = placeBelow ? rect.bottom + 12 : Math.max(12, rect.top - TOOLTIP_HEIGHT_ESTIMATE - 12);
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - TOOLTIP_WIDTH - 12);

  return (
    <>
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none fixed z-[60] rounded-lg border-2 border-accent shadow-[0_0_0_4px_rgba(45,212,191,0.15)]"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed z-[61] flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-4 shadow-2xl shadow-black/40"
        style={{ top, left, width: TOOLTIP_WIDTH }}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            Step {stepIndex + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tour"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{step.body}</p>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            disabled={stepIndex === 0}
            className={cn(
              'flex items-center gap-1 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary',
              stepIndex === 0 && 'invisible',
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            Back
          </button>
          <Button size="sm" onClick={onNext}>
            {stepIndex === total - 1 ? 'Done' : 'Next'}
            {stepIndex < total - 1 && <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />}
          </Button>
        </div>
      </motion.div>
    </>
  );
}
