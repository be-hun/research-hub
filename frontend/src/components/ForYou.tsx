import Link from "next/link";
import type { CollaboratorMatch, CompatibilityMatch, ForYou as ForYouData } from "@/lib/types";
import AwardRow from "./AwardRow";
import Icon from "./Icon";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import { CollegeTag } from "./Tags";
import MatchBadge from "./profile/MatchBadge";
import ReasonChips from "./profile/ReasonChips";
import { reasonChips } from "@/lib/matchReasons";

// ---------- cards ----------

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
  const p = match.project;
  const chips = reasonChips(match.reasons);
  return (
    <li className="border-b border-line last:border-b-0 pb-3">
      <div className="pt-3 -mb-2 flex justify-end">
        <MatchBadge band={match.band} score={match.score} chips={chips} />
      </div>
      <ul>
        <AwardRow project={p} stacked />
      </ul>
      <div className="-mt-2">
        <ReasonChips chips={chips} />
      </div>
      <div className="flex items-center gap-1 mt-2">
        <SaveButton compact item={{ kind: "record", id: p.id, title: p.title, detail: p.statusLabel }} />
        <ShareButton path={`/projects/${p.id}`} title={p.title} />
      </div>
    </li>
  );
}

function PersonMatch({ person, total }: { person: CollaboratorMatch; total: number }) {
  // The backend compares the person's own college with yours, so the college chip is already consistent.
  const chips = reasonChips(person.reasons);
  return (
    <li className="py-4 border-b border-line last:border-b-0 flex gap-3">
      <span className="w-10 h-10 rounded-full bg-cherry-tint text-cherry font-serif font-semibold text-small flex items-center justify-center shrink-0" aria-hidden="true">
        {person.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/researchers/${person.researcherId}`}
            className="text-body font-semibold hover:text-cherry hover:underline underline-offset-2 min-w-0 break-words"
          >
            {person.name}
          </Link>
          <MatchBadge band={person.band} score={person.score} chips={chips} rank={person.rank} total={total} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-3">
          <CollegeTag id={person.college} />
          {person.title && <span className="break-words">{person.title}</span>}
          <span className="text-tiny font-semibold text-ink-2 num">
            #{person.rank.toLocaleString()}
            {total > 0 && <span className="font-normal text-ink-3"> of {total.toLocaleString()}</span>}
          </span>
        </div>
        <ReasonChips chips={chips} />
        {person.citations.length > 0 && (
          <p className="text-tiny text-ink-3 mt-1.5">
            Based on {person.citations.length} public {person.citations.length === 1 ? "record" : "records"}
          </p>
        )}
        <div className="flex items-center gap-1 mt-2">
          <SaveButton
            compact
            item={{ kind: "researcher", id: person.researcherId, title: person.name, detail: person.title || undefined }}
          />
          <ShareButton path={`/researchers/${person.researcherId}`} title={person.name} />
        </div>
      </div>
    </li>
  );
}

/**
 * Recruiting trials, active grants and possible collaborators for the demo account, from POST /api/for-you.
 * Every match leads with its overlap band; the points behind it are one click away. Scores are computed from stored
 * records; the model is not involved.
 */
export default function ForYou({
  data,
  limit,
}: {
  data: ForYouData;
  limit?: number;
}) {
  const take = <T,>(items: T[]) => (limit ? items.slice(0, limit) : items);
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-small text-ink-2 bg-surface border border-line rounded-lg px-3 py-2">
        <Icon name="info" size={18} className="text-ink-3 mt-0.5 shrink-0" />
        <span>
          <strong className="text-ink font-semibold">A discovery aid, not a recommendation.</strong> Matches count
          shared topics and keywords in public records. An active grant shows funding, not that a study is recruiting,
          and trial status comes from ClinicalTrials.gov and may be out of date.
        </span>
      </p>
      <div className={`grid gap-6 ${limit ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <Column title="Recruiting trials" empty="No recruiting trial shares your topics or interests right now. Trials linked to your college alone aren’t listed.">
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
            <PersonMatch key={p.researcherId} person={p} total={data.collaboratorTotal} />
          ))}
        </Column>
      </div>
      {data.collaboratorTotal > data.collaborators.length && (
        <p className="text-small">
          <Link href="/account/people" className="font-semibold text-cherry hover:underline underline-offset-2">
            See all {data.collaboratorTotal.toLocaleString()} researchers who share your interests →
          </Link>
        </p>
      )}
    </div>
  );
}
