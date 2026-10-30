import type { Series, YearDatum } from "@/components/charts/YearBars";
import type { YearStat } from "./types";

// Funder series. Validated together as a categorical set; never reused for colleges.
export const FUNDER_SERIES: Series[] = [
  { key: "nih", label: "NIH", color: "#A41E35" },
  { key: "nsf", label: "NSF", color: "#1E6FB8" },
  { key: "other", label: "Other federal (CDC, AHRQ)", color: "#EDA100" },
];

export function trendData(trend: YearStat[]): { data: YearDatum[]; series: Series[] } {
  const series = FUNDER_SERIES.filter((s) => trend.some((y) => (y as unknown as Record<string, number>)[s.key] > 0));
  return {
    series,
    data: trend.map((y) => ({
      year: y.fiscalYear,
      values: { nih: y.nih, nsf: y.nsf, other: y.other },
      note: y.mayBeIncomplete ? `FY${y.fiscalYear} may be incomplete: the funders are still publishing records.` : undefined,
    })),
  };
}
