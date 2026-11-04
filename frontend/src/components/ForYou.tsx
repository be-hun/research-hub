import Link from "next/link";
import type { CollaboratorMatch, CompatibilityMatch, ForYou as ForYouData } from "@/lib/types";
import AwardRow from "./AwardRow";
import { CollegeTag } from "./Tags";

function Score({ value }: { value: number }) {
  return <span className="text-tiny font-semibold text-cherry num shrink-0">{value}/100 match</span>;
}

function Column({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="min-w-0">
      <h3 className="text-h3 mb-3">{title}</h3>
      {children.length ? (
        <ul className="bg-surface border border-line rounded-xl px-4">{children}</ul>
      ) : (
        <p className="bg-surface border border-line rounded-xl p-4 text-small text-ink-3">{empty}</p>
      )}
    </section>
  );
}

function RecordMatch({ match }: { match: CompatibilityMatch }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="pt-3 -mb-2 flex justify-end">
        <Score value={match.score} />
      </div>
      <ul>
        <AwardRow project={match.project} context={match.reasons.join(" · ")} />
      </ul>
    </li>
  );
}

function PersonMatch({ person }: { person: CollaboratorMatch }) {
  return (
    <li className="py-4 border-b border-line last:border-b-0 flex gap-3">
      <span className="w-10 h-10 rounded-full bg-cherry-tint text-cherry font-serif font-semibold text-small flex items-center justify-center shrink-0" aria-hidden="true">
        {person.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/researchers/${person.researcherId}`} className="text-body font-semibold hover:text-cherry hover:underline underline-offset-2">
            {person.name}
          </Link>
          <Score value={person.score} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-3">
          <CollegeTag id={person.college} />
          {person.title && <span>{person.title}</span>}
        </div>
        {person.reasons.length > 0 && <p className="text-tiny text-ink-2 mt-1">{person.reasons.join(" · ")}</p>}
        {person.citations.length > 0 && (
          <p className="text-tiny text-ink-3 mt-0.5">
            Based on {person.citations.length} public {person.citations.length === 1 ? "record" : "records"}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Recruiting trials, active grants and possible collaborators for the demo account, from POST /api/for-you.
 * Scores are computed from stored records; the model is not involved.
 */
export default function ForYou({ data, limit }: { data: ForYouData; limit?: number }) {
  const take = <T,>(items: T[]) => (limit ? items.slice(0, limit) : items);
  return (
    <div className="space-y-6">
      <div className={`grid gap-6 ${limit ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <Column title="Recruiting trials" empty="No recruiting trials match your interests right now.">
          {take(data.trials).map((m) => (
            <RecordMatch key={m.project.id} match={m} />
          ))}
        </Column>
        <Column title="Active grants" empty="No active grants match your interests right now.">
          {take(data.grants).map((m) => (
            <RecordMatch key={m.project.id} match={m} />
          ))}
        </Column>
        <Column title="People to connect with" empty="No researchers share your interests yet.">
          {take(data.collaborators).map((p) => (
            <PersonMatch key={p.researcherId} person={p} />
          ))}
        </Column>
      </div>
      <p className="text-tiny text-ink-3">
        A discovery aid, not a recommendation. Scores come from shared topics, keywords and colleges in public records.
        An active grant shows funding, not that a study is recruiting; trial status comes from ClinicalTrials.gov and may
        be out of date.
      </p>
    </div>
  );
}
