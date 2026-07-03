import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';
import { NavSidebar } from './_components/nav-sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <div className="flex min-h-screen bg-bg-base">
        <NavSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RealtimeProvider>
  );
}
