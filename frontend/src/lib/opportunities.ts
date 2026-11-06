// Display helpers for federal funding calls (see docs/api.md, "Funding opportunities"). They only format what the
// agency published: a deadline label is built from closeDate and daysLeft, never guessed.
import { opportunityQueryString, type OpportunityParams } from "./api";
import { money, shortDate } from "./format";
import type { Opportunity, OpportunitySort, OpportunityStatus } from "./types";

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  posted: "Open",
  forecasted: "Forecasted",
  closed: "Closed",
};

export const SORT_LABELS: Record<OpportunitySort, string> = {
  deadline: "Deadline",
  relevance: "Relevance",
  newest: "Newest",
};

export const CLOSES_WITHIN = [30, 60, 90] as const;

/** Under this many days a real (not estimated) deadline gets the urgent styling. */
export const URGENT_DAYS = 14;

/** Grants.gov applicant-type codes for higher education: 06 public and state-controlled, 20 private. */
export const HIGHER_ED_CODES = ["06", "20"];

/** The site's own search on Grants.gov, for when a call isn't here (or nothing is loaded yet). */
export const GRANTS_GOV_SEARCH = "https://www.grants.gov/search-grants";

export type DeadlineTone = "urgent" | "open" | "estimated" | "none" | "closed";

/**
 * "Closes in 23 days", "Closes today", "Estimated: Mar 3, 2027", "No fixed deadline", "Closed Mar 3, 2026".
 * `date` is the deadline itself, for a title or a second line; it is "" without one.
 */
export function deadlineLabel(o: Pick<Opportunity, "status" | "closeDate" | "closeDateEstimated" | "daysLeft">): {
  text: string;
  tone: DeadlineTone;
  date: string;
} {
  const date = shortDate(o.closeDate);
  if (!o.closeDate) return { text: "No fixed deadline", tone: "none", date };
  if (o.closeDateEstimated || o.status === "forecasted") return { text: `Estimated: ${date}`, tone: "estimated", date };
  const d = o.daysLeft;
  if (o.status === "closed" || (d != null && d < 0)) return { text: `Closed ${date}`, tone: "closed", date };
  if (d == null) return { text: `Closes ${date}`, tone: "open", date };
  if (d === 0) return { text: "Closes today", tone: "urgent", date };
  if (d === 1) return { text: "Closes tomorrow", tone: "urgent", date };
  return { text: `Closes in ${d} days`, tone: d < URGENT_DAYS ? "urgent" : "open", date };
}

/** "$100K–$500K", "up to $500K", "from $100K", or null when the call names neither. Grants.gov often sends a 0 floor. */
export function awardRange(floor: number | null, ceiling: number | null): string | null {
  const lo = floor && floor > 0 ? floor : null;
  const hi = ceiling && ceiling > 0 ? ceiling : null;
  if (lo && hi) return lo === hi ? money(hi) : `${money(lo)}–${money(hi)}`;
  if (hi) return `up to ${money(hi)}`;
  if (lo) return `from ${money(lo)}`;
  return null;
}

/** Exact dollars for the detail page's facts: "$1,250,000". "Not stated" when the call leaves it blank. */
export function dollars(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return "Not stated";
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function opportunitiesHref(p: OpportunityParams): string {
  const qs = opportunityQueryString(p);
  return qs ? `/opportunities?${qs}` : "/opportunities";
}
