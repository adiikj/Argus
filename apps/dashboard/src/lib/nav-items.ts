import { LayoutDashboard, ShieldAlert, FileText, Search, Crosshair } from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/alerts', label: 'Alerts', icon: ShieldAlert },
  { href: '/incidents', label: 'Incident Details', icon: FileText },
  { href: '/logs', label: 'Log Explorer', icon: Search },
  { href: '/simulator', label: 'Attack Simulator', icon: Crosshair },
];
