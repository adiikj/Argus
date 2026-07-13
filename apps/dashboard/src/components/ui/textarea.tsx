import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-border-subtle bg-bg-panel px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent/50 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
