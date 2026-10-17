'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Compass, Tv, Info, LogOut, X } from 'lucide-react';
import { Wordmark } from '../../_components/wordmark';
import { useRealtime } from '@/lib/realtime';
import { useTour } from '@/lib/tour';
import { clearToken } from '@/lib/auth';
import { NAV_SECTIONS } from '@/lib/nav-items';
import { useCommandPalette } from './command-palette';
import { cn } from '@/lib/utils';

const ITEM =
  'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors';

// the sidebar body — rendered fixed on desktop and inside the drawer on mobile
export function NavSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected } = useRealtime();
  const { setOpen } = useCommandPalette();
  const { start: startTour } = useTour();

  const logout = (): void => {
    clearToken();
    router.replace('/login');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Wordmark href="/overview" />
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            setOpen(true);
          }}
          className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-bg-base/60 px-3 py-2 text-[13px] text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            Search or jump to…
          </span>
          <kbd className="rounded border border-border-subtle bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      ITEM,
                      active
                        ? 'bg-bg-elevated text-text-primary'
                        : 'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary',
                    )}
                  >
                    {active && (
                      <span className="bg-accent absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full" />
                    )}
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        active ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary',
                      )}
                      strokeWidth={1.9}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border-subtle p-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            startTour();
          }}
          className={cn(
            ITEM,
            'w-full text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary',
          )}
        >
          <Compass className="h-4 w-4 text-text-muted" strokeWidth={1.9} />
          Take the tour
        </button>
        <Link
          href="/wall"
          className={cn(
            ITEM,
            'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary',
          )}
        >
          <Tv className="h-4 w-4 text-text-muted" strokeWidth={1.9} />
          SOC wall
        </Link>
        <Link
          href="/about"
          className={cn(
            ITEM,
            'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary',
          )}
        >
          <Info className="h-4 w-4 text-text-muted" strokeWidth={1.9} />
          About Argus
        </Link>
        <button
          type="button"
          onClick={logout}
          className={cn(
            ITEM,
            'w-full text-text-secondary hover:bg-severity-critical/10 hover:text-severity-critical',
          )}
        >
          <LogOut className="h-4 w-4 text-text-muted" strokeWidth={1.9} />
          Log out
        </button>

        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-base/50 px-3 py-2">
          <span className="relative flex h-2 w-2">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-severity-ok opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                connected ? 'bg-severity-ok' : 'bg-severity-info',
              )}
            />
          </span>
          <span className="font-mono text-[11px] text-text-secondary">
            {connected ? 'Live stream connected' : 'Stream disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}
