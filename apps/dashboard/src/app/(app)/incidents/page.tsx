import { FileText } from 'lucide-react';
import { EmptyState } from '../_components/empty-state';

export default function IncidentsPage() {
  return (
    <EmptyState
      icon={FileText}
      title="No incident selected"
      body="Pick an incident from Alerts to see its full timeline, alerts, and AI summary."
    />
  );
}
