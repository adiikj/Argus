import { Search } from 'lucide-react';
import { EmptyState } from '../_components/empty-state';

export default function LogsPage() {
  return (
    <EmptyState
      icon={Search}
      title="Log Explorer opens once search lands"
      body="Full-text and field search over the normalized event stream in Elasticsearch, plus the pipeline trace view for following one event end to end. Both are Day 11."
    />
  );
}
