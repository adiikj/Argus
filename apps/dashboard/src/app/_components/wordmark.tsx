import Image from 'next/image';
import Link from 'next/link';

export function Wordmark({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Argus — home"
    >
      <Image
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        priority
        className="-my-2 transition-transform group-hover:scale-110"
      />
      <span className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">
        Argus
      </span>
    </Link>
  );
}
