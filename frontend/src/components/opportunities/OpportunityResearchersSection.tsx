import Link from "next/link";
import Icon from "@/components/Icon";
import Section from "@/components/Section";
import BandPill from "@/components/profile/BandPill";
import { CollegeTag } from "@/components/Tags";
import { getOpportunityResearchers } from "@/lib/api";
import { college } from "@/lib/colleges";
import type { OpportunityResearcher } from "@/lib/types";

const TITLE = "Who at Temple could apply";
const SUBTITLE = "Temple researchers whose public records overlap this call. Overlap, not a recommendation or an eligibility check.";

function ResearcherCard({ r }: { r: OpportunityResearcher }) {
  const p = r.person;
  return (
    <Link
      href={`/researchers/${encodeURIComponent(p.researcherId)}`}
      className="group flex gap-3 h-full rounded-xl border border-line bg-surface p-4 hover:border-cherry"
    >
      <span
        className="w-10 h-10 rounded-full bg-cherry-tint text-cherry font-serif font-semibold flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        {p.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="font-semibold text-ink group-hover:text-cherry break-words">{p.name}</span>
          <BandPill band={r.band} />
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-tiny text-ink-3">
          <CollegeTag id={p.college} />
          {p.department && <span className="break-words">{p.department}</span>}
        </span>
        {r.awardedUnderProgram && (
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-active-bg text-active-ink text-tiny font-semibold">
            <Icon name="check" size={14} />
            Awarded under this program
          </span>
        )}
        {r.reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-small text-ink-2">
            {r.reasons.map((reason) => (
              <li key={reason} className="flex gap-1.5">
                <span className="text-ink-3" aria-hidden="true">
                  ·
                </span>
                <span className="min-w-0 break-words">{reason}</span>
              </li>
            ))}
          </ul>
        )}
      </span>
    </Link>
  );
}

/**
 * Temple researchers whose stored records overlap a call. Fetched on its own (inside Suspense on the detail page),
 * so a slow or failed request only affects this section, never the call itself.
 */
export default async function OpportunityResearchersSection({ id }: { id: string }) {
  const data = await getOpportunityResearchers(id).catch(() => undefined);
  if (data === undefined) {
    return (
      <Section title={TITLE}>
        <p className="text-small text-ink-3">We couldn&apos;t load matching researchers right now. Reload the page to try again.</p>
      </Section>
    );
  }
  if (!data || data.researchers.length === 0) {
    return (
      <Section title={TITLE}>
        <p className="text-small text-ink-3">No Temple researcher&apos;s public records overlap this call closely enough to list.</p>
      </Section>
    );
  }
  const colleges = Array.from(new Set(data.researchers.map((r) => r.person.college).filter(Boolean)));
  return (
    <Section title={TITLE} subtitle={SUBTITLE}>
      {data.crossCollege && (
        <p className="flex items-start gap-2 text-small text-ink-2 bg-running-bg border border-running-ink/20 rounded-lg px-3 py-2 mb-4">
          <Icon name="group" size={18} className="text-running-ink mt-px" />
          <span>
            <span className="font-semibold text-running-ink">Cross-college team.</span> These researchers span{" "}
            {colleges.length > 1 ? `${colleges.length} colleges` : "more than one college"}
            {colleges.length > 1 && <> ({colleges.map((c) => college(c)?.short ?? c).join(", ")})</>}.
          </span>
        </p>
      )}
      <ul className="grid md:grid-cols-2 gap-3">
        {data.researchers.map((r) => (
          <li key={r.person.researcherId}>
            <ResearcherCard r={r} />
          </li>
        ))}
      </ul>
      {data.notice && <p className="text-tiny text-ink-3 mt-3">{data.notice}</p>}
    </Section>
  );
}

export function OpportunityResearchersSkeleton() {
  return (
    <Section title={TITLE} subtitle={SUBTITLE}>
      <div className="grid md:grid-cols-2 gap-3 animate-pulse" aria-busy="true" aria-label="Loading researchers">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-line" />
        ))}
      </div>
    </Section>
  );
}
