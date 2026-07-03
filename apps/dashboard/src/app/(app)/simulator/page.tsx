import { Crosshair } from 'lucide-react';
import { EmptyState } from '../_components/empty-state';

export default function SimulatorPage() {
  return (
    <EmptyState
      icon={Crosshair}
      title="The control panel isn't wired up yet"
      body="The generator already exposes /simulate for all five attack scenarios — this page just needs a UI in front of it. Landing on Day 10, next to Incident Details."
    />
  );
}
