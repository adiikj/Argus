'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShieldAlert, FileText, Search, Crosshair } from 'lucide-react';
import { Wordmark } from '../../_components/wordmark';
import { useRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/alerts', label: 'Alerts', icon: ShieldAlert },
  { href: '/incidents', label: 'Incident Details', icon: FileText },
  { href: '/logs', label: 'Log Explorer', icon: Search },
  { href: '/simulator', label: 'Attack Simulator', icon: Crosshair },
];

export function NavSidebar() {
  const pathname = usePathname();
  const { connected } = useRealtime();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border-subtle bg-bg-panel">
      <div className="border-b border-border-subtle px-4 py-4">
        <Wordmark />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
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

      <div className="flex items-center gap-2 border-t border-border-subtle px-4 py-3 font-mono text-xs text-text-secondary">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            connected ? 'animate-pulse bg-severity-ok' : 'bg-severity-info',
          )}
        />
        {connected ? 'connected' : 'disconnected'}
      </div>
    </aside>
  );
}
