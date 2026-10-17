'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search } from 'lucide-react';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { useMetricsHistory } from '@/lib/use-metrics-history';
import { useSessionRole } from '@/lib/use-session-role';
import { navItemFor } from '@/lib/nav-items';
import { cn } from '@/lib/utils';
import { NavSidebar } from './nav-sidebar';
import { useCommandPalette } from './command-palette';

const POLL_SECONDS = 3; // useMetrics' refetch interval

function LivePill() {
  const { connected } = useRealtime();
  const { data: metrics } = useMetrics();
  const history = useMetricsHistory(metrics);
  const last = history.at(-1);
  const eps = last ? last.events / POLL_SECONDS : 0;

  return (
    <div className="hidden items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/70 px-3 py-1 sm:flex">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          connected ? 'bg-severity-ok' : 'bg-severity-info',
        )}
      />
      <span className="font-mono text-[11px] text-text-secondary">
        {connected ? 'live' : 'offline'}
        <span className="mx-1.5 text-text-muted">·</span>
        <span className="tabular-nums text-text-primary">{eps.toFixed(1)}</span> ev/s
      </span>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  const role = useSessionRole();
  const { setOpen } = useCommandPalette();

  return (
    <header className="glass sticky top-0 z-30 border-b border-border-subtle">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="text-text-muted">Argus</span>
          <span className="text-text-muted">/</span>
          <span className="truncate font-medium text-text-primary">{item?.label ?? 'Console'}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LivePill />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="rounded-md p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary lg:hidden"
          >
            <Search className="h-4 w-4" />
          </button>
          {role && (
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider',
                role === 'viewer'
                  ? 'border-severity-medium/30 bg-severity-medium/10 text-severity-medium'
                  : 'border-accent/30 bg-accent/10 text-accent',
              )}
              title={role === 'viewer' ? 'Read-only demo account' : `Signed in as ${role}`}
            >
              {role === 'viewer' ? 'demo · read-only' : role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// console chrome: fixed sidebar on desktop, a slide-in drawer below lg,
// a sticky glass top bar with the page, live stream status and the session role
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="relative flex min-h-screen bg-bg-base">
      <aside className="sticky top-0 z-20 hidden h-screen w-60 shrink-0 border-r border-border-subtle bg-bg-panel lg:block">
        <NavSidebar />
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border-subtle bg-bg-panel lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <NavSidebar onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-10 min-w-0 flex-1">
        <TopBar onMenu={() => setDrawerOpen(true)} />
        {children}
      </div>
    </div>
  );
}
