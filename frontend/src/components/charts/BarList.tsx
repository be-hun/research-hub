import Link from "next/link";

export interface BarRow {
  key: string;
  label: string;
  href?: string;
  color: string; // identity color of the entity, never its rank
  value: number;
  valueLabel: string;
  detail?: string;
}

/** Horizontal bars with direct labels. Every row is a link to the records behind it. */
export default function BarList({ rows, caption }: { rows: BarRow[]; caption: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">{caption}</figcaption>
      <ul className="space-y-1">
        {rows.map((r) => {
          const pct = Math.max((r.value / max) * 100, 1.5);
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3 mb-1.5 min-w-0">
                <span className="text-small font-medium text-ink truncate min-w-0" title={r.label}>{r.label}</span>
                <span className="num text-small font-semibold text-ink shrink-0">{r.valueLabel}</span>
              </div>
              <div className="h-2.5 rounded-r bg-canvas" aria-hidden="true">
                <div className="h-full rounded-r" style={{ width: `${pct}%`, background: r.color }} />
              </div>
              {r.detail && <div className="text-tiny text-ink-3 mt-1 num">{r.detail}</div>}
            </>
          );
          const cls = "block -mx-2 px-2 py-2 rounded-md";
          return (
            <li key={r.key}>
              {r.href ? (
                <Link href={r.href} className={`${cls} hover:bg-canvas`}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
