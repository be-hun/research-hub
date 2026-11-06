import Section from "@/components/Section";
import type { Opportunity } from "@/lib/types";
import OpenCallsRow from "./OpenCallsRow";

/**
 * Open Grants.gov calls under the same assistance listing as this award (GET /api/projects/:id/opportunities).
 * Hidden when there are none. The same program, not an eligibility check.
 */
export default function OpenCallsForProject({ calls }: { calls: Opportunity[] }) {
  if (calls.length === 0) return null;
  return (
    <Section
      title="Open calls under this program"
      subtitle="Federal calls on Grants.gov that list the same assistance listing number as this grant."
    >
      <ul className="bg-surface border border-line rounded-xl px-4">
        {calls.map((o) => (
          <OpenCallsRow
            key={o.id}
            opportunity={o}
            reason={o.programs.length ? `Assistance listing${o.programs.length > 1 ? "s" : ""} ${o.programs.join(", ")}` : undefined}
          />
        ))}
      </ul>
      <p className="text-tiny text-ink-3 mt-3">
        Sharing a program is not an eligibility check: read each call&apos;s own eligibility section before applying.
        Deadlines change, so confirm them on Grants.gov.
      </p>
    </Section>
  );
}
