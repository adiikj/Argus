import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';
import { ToastProvider } from '@/lib/toast';
import { TourProvider } from '@/lib/tour';
import { AuthGate } from './_components/auth-gate';
import { AppShell } from './_components/app-shell';
import { CommandPaletteProvider } from './_components/command-palette';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <RealtimeProvider>
        <ToastProvider>
          <CommandPaletteProvider>
            <TourProvider>
              <AppShell>{children}</AppShell>
            </TourProvider>
          </CommandPaletteProvider>
        </ToastProvider>
      </RealtimeProvider>
    </AuthGate>
  );
}
