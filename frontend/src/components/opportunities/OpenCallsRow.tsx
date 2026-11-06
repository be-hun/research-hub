import Link from "next/link";
import BandPill from "@/components/profile/BandPill";
import { shortDate } from "@/lib/format";
import type { MatchBand, Opportunity } from "@/lib/types";

/** "Closes in 23 days", "Estimated deadline Mar 3, 2027" for a forecast, or the agency's own wording. */
export function openCallDeadline(o: Opportunity): string {
  if (!o.closeDate) return o.closeDateNote || "No deadline listed";
  const date = shortDate(o.closeDate);
  if (o.closeDateEstimated) return `Estimated deadline ${date}`;
  if (o.daysLeft == null) return `Closes ${date}`;
  if (o.daysLeft < 0) return `Closed ${date}`;
  if (o.daysLeft === 0) return "Closes today";
  if (o.daysLeft === 1) return "Closes tomorrow";
  return o.daysLeft <= 90 ? `Closes in ${o.daysLeft} days` : `Closes ${date}`;
}

const STATUS = {
  posted: { label: "Open", className: "bg-active-bg text-active-ink" },
  forecasted: { label: "Forecasted", className: "bg-soon-bg text-soon-ink" },
  closed: { label: "Closed", className: "bg-canvas border border-line text-ink-2" },
} as const;

/** One funding call as a compact row: agency, status, deadline and, when it was matched, the band and one reason. */
export default function OpenCallsRow({
  opportunity: o,
  band,
  reason,
}: {
  opportunity: Opportunity;
  band?: MatchBand;
  reason?: string;
}) {
  const status = STATUS[o.status];
  const soon = o.status === "posted" && o.daysLeft != null && o.daysLeft <= 14;
  return (
    <li className="py-4 border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-tiny font-semibold text-ink-2" title={o.agencyName}>
            {o.agency}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-tiny font-semibold whitespace-nowrap ${status.className}`}>
            {status.label}
          </span>
        </span>
        {band && <BandPill band={band} />}
      </div>
      <h3 className="font-sans text-body font-semibold leading-snug line-clamp-3 break-words" title={o.title}>
        <Link href={`/opportunities/${encodeURIComponent(o.id)}`} className="hover:text-cherry hover:underline underline-offset-2">
          {o.title}
        </Link>
      </h3>
      <p className="text-small text-ink-3 mt-1 break-words">
        <span className={soon ? "font-semibold text-soon-ink" : "text-ink-2"}>{openCallDeadline(o)}</span>
        <span aria-hidden="true"> · </span>
        <span className="num">{o.number}</span>
      </p>
      {reason && <p className="text-tiny text-ink-2 mt-1 break-words">{reason}</p>}
    </li>
  );
}
