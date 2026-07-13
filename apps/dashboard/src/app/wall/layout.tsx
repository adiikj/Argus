import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';
import { AuthGate } from '../(app)/_components/auth-gate';

// deliberately thin — no NavSidebar/CommandPalette/Tour, none of that chrome
// belongs on a fullscreen wall display. Still gated the same as the rest of
// the console since it shows real incident data.
export default function WallLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <RealtimeProvider>{children}</RealtimeProvider>
    </AuthGate>
  );
}
