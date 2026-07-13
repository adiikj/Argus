import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';
import { ToastProvider } from '@/lib/toast';
import { TourProvider } from '@/lib/tour';
import { AuthGate } from './_components/auth-gate';
import { NavSidebar } from './_components/nav-sidebar';
import { CommandPaletteProvider } from './_components/command-palette';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <RealtimeProvider>
        <ToastProvider>
          <CommandPaletteProvider>
            <TourProvider>
              <div className="flex min-h-screen bg-bg-base">
                <NavSidebar />
                <div className="min-w-0 flex-1">{children}</div>
              </div>
            </TourProvider>
          </CommandPaletteProvider>
        </ToastProvider>
      </RealtimeProvider>
    </AuthGate>
  );
}
