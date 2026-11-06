import Link from "next/link";
import SaveButton from "@/components/SaveButton";
import ShareButton from "@/components/ShareButton";
import { CollegeTag, KindTag, SourceTag, StatusChip } from "@/components/Tags";
import { isStaleTrialStatus, money, yearRange } from "@/lib/format";
import { reasonChips } from "@/lib/matchReasons";
import type { CompatibilityMatch } from "@/lib/types";
import MatchBadge from "./MatchBadge";
import ReasonChips from "./ReasonChips";

/** Who leads a record, in the record's own terms: a trial's sponsor, a grant's principal investigator. */
function lead(m: CompatibilityMatch) {
  const p = m.project;
  if (p.kind === "trial") {
    const investigator = p.pi.name.trim();
    const sponsor = p.funder.trim();
    return [investigator && `Lead investigator: ${investigator}`, sponsor ? `Sponsor: ${sponsor}` : "Sponsor not listed"]
      .filter(Boolean)
      .join(" · ");
  }
  return [p.pi.name.trim() || "Principal investigator not listed", p.pi.department].filter(Boolean).join(" · ");
}

/** One recruiting trial or active grant in the "New for you" feed. */
export default function FeedCard({ match }: { match: CompatibilityMatch }) {
  const p = match.project;
  const chips = reasonChips(match.reasons);
  const stale = p.kind === "trial" && isStaleTrialStatus(p.statusLabel, p.endYear);
  const when = yearRange(p.startYear, p.endYear);
  return (
    <article className="rounded-lg border border-line p-4 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
          <KindTag kind={p.kind} />
          <StatusChip label={p.statusLabel} active={p.active} stale={stale} />
          {p.kind === "award" && <SourceTag agency={p.agency} />}
        </div>
        <MatchBadge band={match.band} score={match.score} chips={chips} />
      </div>
      <h3 className="font-sans text-body font-semibold leading-snug mt-2 line-clamp-3 break-words" title={p.title}>
        <Link href={`/projects/${p.id}`} className="hover:text-cherry hover:underline underline-offset-2">
          {p.title}
        </Link>
      </h3>
      <p className="text-small text-ink-3 mt-1 break-words">{lead(match)}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-small text-ink-2">
        {p.colleges.length ? (
          p.colleges.map((c) => <CollegeTag key={c} id={c} />)
        ) : (
          <span className="text-tiny text-ink-3">No Temple college listed</span>
        )}
        {when && <span className="num text-tiny text-ink-3">{when}</span>}
        {p.kind === "award" && p.amount ? (
          <span className="num text-tiny text-ink-3">{money(p.amount)} in the latest fiscal year</span>
        ) : null}
      </div>
      <ReasonChips chips={chips} className="mt-3" />
      <div className="flex items-center gap-1 mt-3 -ml-2">
        <SaveButton compact item={{ kind: "record", id: p.id, title: p.title, detail: p.statusLabel }} />
        <ShareButton path={`/projects/${p.id}`} title={p.title} />
      </div>
    </article>
  );
}
