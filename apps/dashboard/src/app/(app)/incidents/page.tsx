import { FileText } from 'lucide-react';
import { EmptyState } from '../_components/empty-state';

export default function IncidentsPage() {
  return (
    <EmptyState
      icon={FileText}
      title="Incident details need a read path first"
      body="This page will show one incident's full timeline, alerts, and AI summary. It's waiting on a REST endpoint into Postgres — landing on Day 10, alongside the Attack Simulator control panel."
    />
  );
}
