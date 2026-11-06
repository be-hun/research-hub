import Link from "next/link";
import { SourceTag } from "@/components/Tags";
import { awardRange, deadlineLabel } from "@/lib/opportunities";
import type { Opportunity } from "@/lib/types";
import { DeadlineBadge, OpportunityStatusChip, UniversitiesTag } from "./OpportunityBadges";

/** One funding call as a compact row: what it is, who offers it, and when it closes. Sits in a bordered list like AwardRow. */
export default function OpportunityRow({ opportunity: o }: { opportunity: Opportunity }) {
  const range = awardRange(o.awardFloor, o.awardCeiling);
  const d = deadlineLabel(o);
  return (
    <li className="py-4 border-b border-line last:border-b-0">
      <div className="flex flex-col gap-x-6 gap-y-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <OpportunityStatusChip status={o.status} />
            <SourceTag agency={o.agency} />
            <span className="text-tiny text-ink-3 num break-all">{o.number}</span>
          </div>
          <h3 className="font-sans text-body font-semibold leading-snug line-clamp-3" title={o.title}>
            <Link href={`/opportunities/${encodeURIComponent(o.id)}`} className="hover:text-cherry hover:underline underline-offset-2">
              {o.title}
            </Link>
          </h3>
          <p className="text-small text-ink-3 mt-1 break-words">
            {o.agencyName}
            {o.categories.length > 0 && <> · {o.categories.join(", ")}</>}
          </p>
          {o.universitiesEligible && (
            <p className="mt-1.5">
              <UniversitiesTag />
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0 text-small sm:flex-col sm:flex-nowrap sm:items-end sm:max-w-[16rem]">
          <DeadlineBadge opportunity={o} />
          {o.daysLeft != null && (d.tone === "urgent" || d.tone === "open") && <span className="text-tiny text-ink-3 num">Due {d.date}</span>}
          {range && (
            <span className="num text-ink-2">
              <span className="text-ink-3">Awards </span>
              {range}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
