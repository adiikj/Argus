'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Compass } from 'lucide-react';
import { Wordmark } from '../../_components/wordmark';
import { useRealtime } from '@/lib/realtime';
import { useTour } from '@/lib/tour';
import { NAV_ITEMS } from '@/lib/nav-items';
import { useCommandPalette } from './command-palette';
import { cn } from '@/lib/utils';

export function NavSidebar() {
  const pathname = usePathname();
  const { connected } = useRealtime();
  const { setOpen } = useCommandPalette();
  const { start: startTour } = useTour();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border-subtle bg-bg-panel">
      <div className="border-b border-border-subtle px-4 py-4">
        <Wordmark />
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
        >
          <span className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
            Search
          </span>
          <span className="rounded border border-border-subtle bg-bg-panel px-1.5 py-0.5 text-[10px]">
            ⌘K
          </span>
        </button>

        <button
          type="button"
          onClick={startTour}
          className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
        >
          <Compass className="h-3.5 w-3.5" strokeWidth={1.8} />
          Take the tour
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 font-mono text-xs transition-colors',
                active
                  ? 'bg-accent/10 text-text-primary'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-accent' : '')} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1.5 border-t border-border-subtle px-4 py-3 font-mono text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              connected ? 'animate-pulse bg-severity-ok' : 'bg-severity-info',
            )}
          />
          {connected ? 'connected' : 'disconnected'}
        </div>
        <Link href="/about" className="transition-colors hover:text-text-primary">
          About this project
        </Link>
      </div>
    </aside>
  );
}
