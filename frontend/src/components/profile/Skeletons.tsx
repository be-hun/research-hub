// Placeholders for the sections that wait on the matches, sized like what replaces them so nothing jumps.

const bar = "rounded bg-line";

export function LineSkeleton({ className = "w-64" }: { className?: string }) {
  return <span className={`inline-block align-middle h-4 max-w-full animate-pulse ${bar} ${className}`} aria-hidden="true" />;
}

export function CardSkeleton({ title, rows = 3, tall = false }: { title: string; rows?: number; tall?: boolean }) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-card p-4 sm:p-6" aria-busy="true" aria-label={`${title}, loading`}>
      <h2 className="text-[22px] leading-[30px] text-ink">{title}</h2>
      <div className="animate-pulse space-y-3 mt-4" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`rounded-lg border border-line p-4 space-y-2.5 ${tall ? "min-h-[168px]" : ""}`}>
            <div className={`h-3 w-1/3 ${bar}`} />
            <div className={`h-4 w-11/12 ${bar}`} />
            <div className={`h-4 w-2/3 ${bar}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SideSkeleton({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-card p-4 sm:p-5" aria-busy="true" aria-label={`${title}, loading`}>
      <h2 className="text-h3 text-ink">{title}</h2>
      <ul className="animate-pulse space-y-4 mt-4" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-12 h-12 rounded-full bg-line shrink-0" />
            <span className="flex-1 space-y-2 pt-1">
              <span className={`block h-4 w-2/3 ${bar}`} />
              <span className={`block h-3 w-1/2 ${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
