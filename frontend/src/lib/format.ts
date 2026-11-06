export function money(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return "—";
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(amount >= 1e7 ? 0 : 1)}M`;
  if (amount >= 1e3) return `$${Math.round(amount / 1e3)}K`;
  return `$${amount}`;
}

export function count(n: number, word: string, plural = `${word}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? word : plural}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "2025" when a record starts and ends in the same year, "2023–2027" otherwise. */
export function yearRange(start: number | null | undefined, end: number | null | undefined): string {
  if (!start && !end) return "";
  if (!start || !end || start === end) return String(start || end);
  return `${start}–${end}`;
}

/**
 * A trial whose registry status still says it is recruiting (or about to) after its listed end year has passed.
 * The registry hasn't been updated, so the label shouldn't be taken at face value.
 */
export function isStaleTrialStatus(status: string, endYear: number, now = new Date()): boolean {
  return ["Recruiting", "Not yet recruiting", "Enrolling by invitation"].includes(status) && endYear < now.getUTCFullYear();
}
