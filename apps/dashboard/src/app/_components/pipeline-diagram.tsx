import type { ReactNode } from 'react';

// one small line glyph per pipeline stage, drawn on a 24px grid
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, ReactNode> = {
  // traffic dropping into a tray
  Ingest: (
    <>
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 14v5h16v-5" />
    </>
  ),
  // partitions of an append-only log
  Stream: (
    <>
      <rect x="3" y="5" width="4" height="3" rx="0.5" />
      <rect x="8.5" y="5" width="4" height="3" rx="0.5" />
      <rect x="14" y="5" width="4" height="3" rx="0.5" />
      <rect x="3" y="10.5" width="4" height="3" rx="0.5" />
      <rect x="8.5" y="10.5" width="4" height="3" rx="0.5" />
      <rect x="3" y="16" width="4" height="3" rx="0.5" />
      <rect x="8.5" y="16" width="4" height="3" rx="0.5" />
      <rect x="14" y="16" width="4" height="3" rx="0.5" />
    </>
  ),
  // three formats folding into one shape
  Normalize: (
    <>
      <circle cx="5" cy="5" r="2" />
      <path d="M3 12h4" />
      <path d="m5 17 2 3H3z" />
      <path d="M8 5c4 0 4 7 7 7M8 12h7M8 19c4 0 4-7 7-7" />
      <rect x="15" y="9" width="6" height="6" rx="1" />
    </>
  ),
  // the Argus eye on a target
  Detect: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  // many alerts, one incident
  Correlate: (
    <>
      <circle cx="5" cy="5" r="1.8" />
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="5" cy="19" r="1.8" />
      <path d="M6.6 5.8 15.5 11M6.8 12h8.4M6.6 18.2l8.9-5.2" />
      <circle cx="18" cy="12" r="3" />
    </>
  ),
  // a written report
  Explain: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
};

export function PipelineDiagram({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="mt-12 grid gap-8 lg:grid-cols-6 lg:gap-6">
      {steps.map(([title, body], i) => {
        const last = i === steps.length - 1;
        return (
          <li key={title} className="group relative flex gap-4 lg:block">
            {!last && (
              <>
                {/* connector to the next stage, with a packet riding it */}
                <span
                  aria-hidden
                  className="absolute top-[22px] right-[-24px] left-11 hidden h-px bg-border-strong lg:block"
                >
                  <span
                    className="animate-travel-x absolute top-1/2 -mt-[3px] h-1.5 w-1.5 rounded-full bg-accent"
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                </span>
                <span
                  aria-hidden
                  className="absolute top-11 bottom-[-32px] left-[22px] w-px bg-border-strong lg:hidden"
                >
                  <span
                    className="animate-travel-y absolute left-1/2 -ml-[3px] h-1.5 w-1.5 rounded-full bg-accent"
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                </span>
              </>
            )}
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-base text-accent transition-colors group-hover:border-accent">
              <Glyph>{GLYPHS[title]}</Glyph>
            </span>
            <div className="pt-1 lg:mt-4 lg:pt-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-text-muted">0{i + 1}</span>
                <h3 className="text-[15px] font-semibold">{title}</h3>
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
