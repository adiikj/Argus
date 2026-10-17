import { cn } from '@/lib/utils';

// tiny inline trend line — no axes, no library; scales the series to its box
export function Sparkline({
  data,
  color = 'var(--color-accent)',
  className,
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  const points = data.length > 1 ? data : [0, 0];
  const max = Math.max(1, ...points);
  const step = 100 / (points.length - 1);
  const coords = points.map((v, i) => [i * step, 30 - (v / max) * 26 - 2] as const);
  const line = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={cn('h-8 w-full overflow-visible', className)}
      aria-hidden
    >
      <path d={`${line} L100,30 L0,30 Z`} fill={color} fillOpacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
