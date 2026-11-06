import AwardRow from "@/components/AwardRow";
import Section from "@/components/Section";
import { plainReasons } from "@/lib/matchReasons";
import type { ResearcherCompatibility } from "@/lib/types";

export default function CompatibilitySection({ compatibility }: { compatibility: ResearcherCompatibility }) {
  return (
    <Section
      id="compatibility"
      title="Compatible active research"
      subtitle="A transparent match based on shared topics, keywords and colleges in public records."
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
                <span className="text-tiny font-semibold uppercase tracking-wider text-ink-3">Compatibility</span>
                <span className="text-small font-semibold text-cherry num">{match.score}/100</span>
              </div>
              <AwardRow project={match.project} context={plainReasons(match.reasons, [], false)} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-tiny text-ink-3 mt-3">
        This is a discovery aid, not a recommendation. Scores are calculated from stored records; active grants show
        funding activity and do not prove a study is recruiting.
      </p>
    </Section>
  );
}
