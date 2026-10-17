import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-medium uppercase leading-none tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border-strong bg-bg-elevated text-text-secondary',
        critical:
          'border-severity-critical/35 bg-severity-critical/12 text-severity-critical shadow-[0_0_12px_-4px_var(--color-severity-critical)]',
        high: 'border-severity-high/35 bg-severity-high/12 text-severity-high',
        medium: 'border-severity-medium/35 bg-severity-medium/12 text-severity-medium',
        low: 'border-severity-low/35 bg-severity-low/12 text-severity-low',
        info: 'border-severity-info/35 bg-severity-info/12 text-severity-info',
        ok: 'border-severity-ok/35 bg-severity-ok/12 text-severity-ok',
        outline: 'border-border-strong text-text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const DOT: Record<string, string> = {
  critical: 'bg-severity-critical',
  high: 'bg-severity-high',
  medium: 'bg-severity-medium',
  low: 'bg-severity-low',
  info: 'bg-severity-info',
  ok: 'bg-severity-ok',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

// severity variants get a leading dot, so severity reads at a glance even in
// a dense table (and isn't carried by color alone — the label is always there)
function Badge({ className, variant, children, ...props }: BadgeProps) {
  const dot = variant ? DOT[variant] : undefined;
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
