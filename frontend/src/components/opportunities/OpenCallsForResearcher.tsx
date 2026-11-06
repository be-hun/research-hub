import Section from "@/components/Section";
import type { ResearcherOpportunity } from "@/lib/types";
import OpenCallsRow from "./OpenCallsRow";

/**
 * Open Grants.gov calls whose topic overlaps this researcher's public records (GET /api/researchers/:id/opportunities).
 * Hidden when there are none. Overlap, not a recommendation or an eligibility check.
 */
export default function OpenCallsForResearcher({ name, calls }: { name: string; calls: ResearcherOpportunity[] }) {
  if (calls.length === 0) return null;
  return (
    <Section
      id="open-calls"
      title="Open funding calls that fit"
      subtitle={`Federal calls on Grants.gov whose topic overlaps ${name}’s public grants, trials or publications.`}
    >
      <ul className="bg-surface border border-line rounded-xl px-4">
        {calls.map((c) => (
          <OpenCallsRow key={c.opportunity.id} opportunity={c.opportunity} band={c.band} reason={c.reasons[0]} />
        ))}
      </ul>
      <p className="text-tiny text-ink-3 mt-3">
        Overlap in public records, not a recommendation or an eligibility check: read each call&apos;s own eligibility
        section before applying. Deadlines change, so confirm them on Grants.gov.
      </p>
    </Section>
  );
}
