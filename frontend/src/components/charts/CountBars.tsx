import type { ResearcherYear } from "@/lib/types";

const SERIES = [
  { key: "grants", label: "Grants", color: "#A41E35" },
  { key: "trials", label: "Clinical trials", color: "#1E6FB8" },
  { key: "publications", label: "Publications", color: "#8A867E" }, // 3.6:1 on white, enough for a bar
] as const;

/** Records per start year, stacked by type, with direct labels and a table equivalent. */
export default function CountBars({ years: given, caption }: { years: ResearcherYear[]; caption: string }) {
  // Years with no records are shown as empty bars, so the timeline never skips a gap.
  const byYear = new Map(given.map((y) => [y.year, y]));
  const lo = Math.min(...given.map((y) => y.year));
  const hi = Math.max(...given.map((y) => y.year));
  const years: ResearcherYear[] = given.length
    ? Array.from({ length: hi - lo + 1 }, (_, i) => byYear.get(lo + i) ?? { year: lo + i, grants: 0, trials: 0, publications: 0 })
    : [];
  const totals = years.map((y) => y.grants + y.trials + y.publications);
  const max = Math.max(...totals, 1);
  const used = SERIES.filter((s) => years.some((y) => y[s.key] > 0));
  const height = 112;

  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      {used.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-tiny text-ink-2" aria-hidden="true">
          {used.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 border-b border-line" style={{ height: height + 18 }} aria-hidden="true">
        {years.map((y, i) => (
          <div key={y.year} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
            <span className="text-tiny text-ink-2 num mb-1">{totals[i]}</span>
            <div className="w-full max-w-[36px] flex flex-col-reverse gap-[2px]">
              {used.map((s) =>
                y[s.key] ? (
                  <div key={s.key} style={{ height: `${(y[s.key] / max) * height}px`, background: s.color }} className="rounded-sm" />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1 text-tiny text-ink-3 num" aria-hidden="true">
        {years.map((y) => (
          <span key={y.year} className="flex-1 min-w-0 text-center">
            ’{String(y.year).slice(2)}
          </span>
        ))}
      </div>
      <details className="mt-3 text-tiny text-ink-3">
        <summary className="cursor-pointer hover:text-ink">View as table</summary>
        <table className="mt-2 w-full num">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left">
              <th className="font-semibold py-1">Start year</th>
              {SERIES.map((s) => (
                <th key={s.key} className="font-semibold py-1 text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="py-1">{y.year}</td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {y[s.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
