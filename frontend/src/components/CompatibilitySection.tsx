import AwardRow from "@/components/AwardRow";
import Section from "@/components/Section";
import BandPill from "@/components/profile/BandPill";
import { plainReasons } from "@/lib/matchReasons";
import type { ResearcherCompatibility } from "@/lib/types";

/**
 * Active grants and recruiting trials that overlap with this researcher's own records. It answers a different
 * question from "You and …" (the signed-in profile's match), so it is worded around the researcher's work.
 */
export default function CompatibilitySection({ compatibility }: { compatibility: ResearcherCompatibility }) {
  return (
    <Section
      id="compatibility"
      title={`Active research related to ${compatibility.researcherName}’s work`}
      subtitle="Active grants and recruiting trials that share topics, keywords or a college with this person's public records."
    >
      {compatibility.matches.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-5 text-small text-ink-2">
          No active grants or recruiting trials matched this profile&apos;s stored research.
        </div>
      ) : (
        <ul className="space-y-3">
          {compatibility.matches.map((match) => (
            <li key={match.project.id} className="bg-surface border border-line rounded-xl px-4">
              <div className="flex items-center justify-between gap-3 pt-3">
                <span className="text-tiny font-semibold uppercase tracking-wider text-ink-3">Overlap with their work</span>
                <BandPill band={match.band} />
              </div>
              {/* AwardRow is an <li>, so it needs its own list inside this card. */}
              <ul>
                <AwardRow project={match.project} context={plainReasons(match.reasons, false)} />
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="text-tiny text-ink-3 mt-3">
        A discovery aid, not a recommendation. Bands are calculated from stored records; active grants show funding
        activity and do not prove a study is recruiting.
      </p>
    </Section>
  );
}
