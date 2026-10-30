"use client";

import { useState } from "react";
import { money } from "@/lib/format";

export interface Series {
  key: string;
  label: string;
  color: string;
}

export interface YearDatum {
  year: number;
  values: Record<string, number>;
  note?: string; // e.g. "may be incomplete"
  missing?: boolean; // no record for this year, which is not the same as $0
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= v / 4)! * mag;
  return Math.ceil(v / step) * step;
}

/** Vertical bars per fiscal year, stacked when there is more than one series. One y-axis, always. */
export default function YearBars({
  data,
  series,
  caption,
  height = 200,
}: {
  data: YearDatum[];
  series: Series[];
  caption: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const hovered = data.find((d) => d.year === hover);

  return (
    <figure className="relative">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 pl-[60px] text-tiny text-ink-2" aria-hidden="true">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-4">
        {/* y-axis labels */}
        <div className="relative w-12 shrink-0 text-tiny text-ink-3 num" style={{ height }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {money(t) === "—" ? "$0" : money(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[6%] px-[3%]">
            {data.map((d, i) => (
              <button
                key={d.year}
                type="button"
                className="relative flex-1 h-full flex flex-col justify-end focus:outline-none"
                onMouseEnter={() => setHover(d.year)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(d.year)}
                onBlur={() => setHover(null)}
                aria-label={`FY${d.year}: ${d.missing ? "no record" : money(totals[i])}${d.note ? `, ${d.note}` : ""}`}
              >
                {d.missing && <span className="text-tiny text-ink-3 text-center pb-1">no record</span>}
                <div className={`flex flex-col-reverse gap-[2px] ${d.note ? "opacity-60" : ""}`}>
                  {series.map((s, si) => {
                    const v = d.values[s.key] ?? 0;
                    if (!v) return null;
                    const isTop = series.slice(si + 1).every((x) => !(d.values[x.key] ?? 0));
                    return (
                      <div
                        key={s.key}
                        style={{ height: `${(v / max) * height}px`, background: s.color }}
                        className={isTop ? "rounded-t" : ""}
                      />
                    );
                  })}
                </div>
                {hover === d.year && <div className="absolute inset-0 -mx-1 bg-ink/5 rounded pointer-events-none" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-2" aria-hidden="true">
        <div className="w-12 shrink-0" />
        <div className="flex-1 flex gap-[6%] px-[3%] text-tiny text-ink-3 num">
          {data.map((d) => (
            <span key={d.year} className="flex-1 text-center">
              FY{String(d.year).slice(2)}
              {d.note ? "*" : ""}
            </span>
          ))}
        </div>
      </div>

      {hovered && (
        <div className="absolute top-0 right-0 bg-surface border border-line rounded-lg shadow-card px-3 py-2 text-tiny pointer-events-none">
          <div className="font-semibold text-ink mb-1">
            FY{hovered.year} ·{" "}
            {hovered.missing ? "no record" : money(series.reduce((s, x) => s + (hovered.values[x.key] ?? 0), 0))}
          </div>
          {series.length > 1 &&
            series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-ink-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                {s.label} <span className="num ml-auto pl-3">{money(hovered.values[s.key] ?? 0)}</span>
              </div>
            ))}
          {hovered.note && <div className="text-ink-3 mt-1">{hovered.note}</div>}
        </div>
      )}

      {data.some((d) => d.note) && (
        <p className="text-tiny text-ink-3 mt-3">* {data.find((d) => d.note)?.note}</p>
      )}

      <details className="mt-3 text-tiny text-ink-3">
        <summary className="cursor-pointer hover:text-ink">View as table</summary>
        <table className="mt-2 w-full num">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left">
              <th className="font-semibold py-1">Fiscal year</th>
              {series.map((s) => (
                <th key={s.key} className="font-semibold py-1 text-right">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year} className="border-t border-line">
                <td className="py-1">FY{d.year}{d.note ? "*" : ""}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {d.missing ? "no record" : money(d.values[s.key] ?? 0)}
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
