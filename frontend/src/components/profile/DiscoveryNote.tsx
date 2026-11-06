import Link from "next/link";
import Icon from "@/components/Icon";
import { SCORE_PARTS } from "@/lib/matchReasons";

/** The caveat that sits beside every list of matches. */
export default function DiscoveryNote() {
  return (
    <aside className="rounded-xl border border-line bg-canvas p-4 sm:p-5 text-small text-ink-2 space-y-2" aria-label="About these matches">
      <p className="flex items-start gap-2">
        <Icon name="info" size={18} className="text-ink-3 mt-0.5 shrink-0" />
        <span>
          <strong className="text-ink font-semibold">A discovery aid, not a recommendation.</strong> Matches count shared
          topics and keywords in public records.
        </span>
      </p>
      <p className="text-tiny text-ink-3">
        {SCORE_PARTS.bands}. An active grant shows funding, not that a study is recruiting, and trial status comes from
        ClinicalTrials.gov and may be out of date. No AI is involved in matching.{" "}
        <Link href="/about#how-it-works" className="underline underline-offset-2 hover:text-ink">
          How this works
        </Link>
      </p>
    </aside>
  );
}
