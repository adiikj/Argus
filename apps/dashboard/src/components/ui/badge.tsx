import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border-subtle bg-bg-elevated text-text-secondary',
        critical: 'border-severity-critical/30 bg-severity-critical/15 text-severity-critical',
        high: 'border-severity-high/30 bg-severity-high/15 text-severity-high',
        medium: 'border-severity-medium/30 bg-severity-medium/15 text-severity-medium',
        low: 'border-severity-low/30 bg-severity-low/15 text-severity-low',
        info: 'border-severity-info/30 bg-severity-info/15 text-severity-info',
        outline: 'border-border-subtle text-text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
