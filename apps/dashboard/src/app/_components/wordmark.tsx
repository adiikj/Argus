import Link from 'next/link';

// the Argus eye: a split ring around a pupil, in the identity teal
export function ArgusMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g fill="none" stroke="var(--color-accent)" strokeWidth={3.2}>
        <path d="M14.4 5.4 A11.2 10.6 0 0 0 14.4 26.6" />
        <path d="M17.6 5.4 A11.2 10.6 0 0 1 17.6 26.6" />
      </g>
      <circle cx={16} cy={16} r={3.9} fill="var(--color-accent)" />
    </svg>
  );
}

export function Wordmark({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2 ${className}`} aria-label="Argus home">
      <ArgusMark />
      <span className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary">Argus</span>
    </Link>
  );
}
