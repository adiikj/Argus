import { useId } from 'react';
import Link from 'next/link';

// the Argus eye — a split ring around a pupil — drawn inline so it stays
// crisp at any size and picks up the brand gradient
export function ArgusMark({ className = 'h-7 w-7' }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-accent-2)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeWidth={3.2} strokeLinecap="butt">
        <path d="M14.4 5.4 A11.2 10.6 0 0 0 14.4 26.6" />
        <path d="M17.6 5.4 A11.2 10.6 0 0 1 17.6 26.6" />
      </g>
      <circle cx={16} cy={16} r={3.9} fill={`url(#${id})`} />
    </svg>
  );
}

export function Wordmark({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Argus — home"
    >
      <span className="relative">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent/30 opacity-0 blur-md transition-opacity group-hover:opacity-100"
        />
        <ArgusMark className="relative h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
      </span>
      <span className="text-[16px] font-semibold tracking-[-0.02em] text-text-primary">Argus</span>
    </Link>
  );
}
