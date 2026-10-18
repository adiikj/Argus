import {
  LayoutDashboard,
  ShieldAlert,
  FileText,
  Search,
  Crosshair,
  ShieldCheck,
  HeartPulse,
  Timer,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Monitor',
    items: [
      {
        href: '/overview',
        label: 'Overview',
        icon: LayoutDashboard,
        description: 'Pipeline health, threats and where they come from',
      },
      {
        href: '/alerts',
        label: 'Alerts',
        icon: ShieldAlert,
        description: 'Live incident feed, searchable in plain English',
      },
      {
        href: '/incidents',
        label: 'Incidents',
        icon: FileText,
        description: 'Correlated attacks, triage and AI summaries',
      },
      {
        href: '/soc',
        label: 'SOC Metrics',
        icon: Timer,
        description: 'Detection and response times, false-positive rates',
      },
      {
        href: '/logs',
        label: 'Log Explorer',
        icon: Search,
        description: 'Full-text search over every normalized event',
      },
    ],
  },
  {
    label: 'Detect',
    items: [
      {
        href: '/coverage',
        label: 'Coverage',
        icon: ShieldCheck,
        description: 'Detection rules mapped to MITRE ATT&CK',
      },
      {
        href: '/simulator',
        label: 'Attack Simulator',
        icon: Crosshair,
        description: 'Fire attack scenarios at the live pipeline',
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        href: '/system',
        label: 'System Health',
        icon: HeartPulse,
        description: 'Kafka lag, storage and database status',
      },
    ],
  },
];

// flat list — the command palette and the top bar's page lookup
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
