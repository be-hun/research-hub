import Link from "next/link";
import type { CollaboratorMatch, CollegeId, CompatibilityMatch, ForYou as ForYouData } from "@/lib/types";
import AwardRow from "./AwardRow";
import Icon from "./Icon";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import { CollegeTag } from "./Tags";
import { reasonChips, type ReasonChip as Chip } from "@/lib/matchReasons";

function ReasonChips({ chips }: { chips: Chip[] }) {
  const shown = chips.filter((c) => c.kind !== "fragment");
  if (!shown.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 mt-2" aria-label="Why this matches">
      {shown.map((c) => (
        <li
          key={c.key}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium ${
            c.kind === "topic" ? "bg-cherry-tint text-cherry-dark" : "bg-canvas border border-line text-ink-2"
          }`}
        >
          {c.kind === "keyword" && <span className="text-ink-3">Your interest:</span>}
          {c.label}
        </li>
      ))}
    </ul>
  );
}

// ---------- the score ----------

/**
 * The score with its recipe one click away. The parts mirror `_score` in backend/app/compatibility.py; only the
 * parts that applied to this match are listed, each with the most it can add.
 */
function Score({ value, chips }: { value: number; chips: Chip[] }) {
  const topics = chips.filter((c) => c.kind === "topic");
  const keywords = chips.filter((c) => c.kind === "keyword" || c.kind === "fragment");
  return (
    <details className="relative shrink-0">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-tiny font-semibold text-cherry num hover:bg-cherry-tint">
        {value}/100 match
        <Icon name="info" size={14} />
        <span className="sr-only">. How this score is built</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-3 shadow-card text-tiny text-ink-2">
        <p className="font-semibold text-ink mb-1.5">How this score is built</p>
        <ul className="space-y-1">
          {topics.length > 0 && (
            <li>
              <span className="text-ink font-medium">Shared topics</span> (up to 60): {topics.map((t) => t.label).join("; ")}
            </li>
          )}
          {keywords.length > 0 && (
            <li>
              <span className="text-ink font-medium">Shared keywords</span> (up to 25): {keywords.map((k) => k.label).join(", ")}
            </li>
          )}
          {chips.some((c) => c.key === "c:same") && (
            <li>
              <span className="text-ink font-medium">Same college</span> (+10)
            </li>
          )}
          {chips.some((c) => c.key === "c:other") && (
            <li>
              <span className="text-ink font-medium">Different college</span> (+5 for people outside yours)
            </li>
          )}
        </ul>
        <p className="mt-2 text-ink-3">
          Counted from topics and words in public records. It measures overlap, not quality or fit. No AI is involved.
        </p>
      </div>
    </details>
  );
}

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

function RecordMatch({ match, terms }: { match: CompatibilityMatch; terms?: string[] }) {
  const p = match.project;
  const chips = reasonChips(match.reasons, terms);
  return (
    <li className="border-b border-line last:border-b-0 pb-3">
      <div className="pt-3 -mb-2 flex justify-end">
        <Score value={match.score} chips={chips} />
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

function PersonMatch({ person, terms, college }: { person: CollaboratorMatch; terms?: string[]; college?: CollegeId | null }) {
  // The backend merges reasons from all of a person's records, so it can say both "same college" and "beyond your
  // college". The person's own college is what a reader means by it, so use that instead.
  const chips = reasonChips(person.reasons, terms).filter((c) => c.kind !== "college");
  if (college && person.college) {
    chips.push(
      person.college === college
        ? { key: "c:same", label: "Your college", kind: "college" }
        : { key: "c:other", label: "Another college", kind: "college" },
    );
  }
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
          <Score value={person.score} chips={chips} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-3">
          <CollegeTag id={person.college} />
          {person.title && <span className="break-words">{person.title}</span>}
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
 * Scores are computed from stored records; the model is not involved. `terms` are the profile's interest keywords,
 * used only to show a multi-word interest ("down syndrome") as one chip.
 */
export default function ForYou({
  data,
  limit,
  terms,
  college,
}: {
  data: ForYouData;
  limit?: number;
  terms?: string[];
  college?: CollegeId | null;
}) {
  const take = <T,>(items: T[]) => (limit ? items.slice(0, limit) : items);
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-small text-ink-2 bg-surface border border-line rounded-lg px-3 py-2">
        <Icon name="info" size={18} className="text-ink-3 mt-0.5 shrink-0" />
        <span>
          <strong className="text-ink font-semibold">A discovery aid, not a recommendation.</strong> Match scores count
          shared topics, keywords and colleges in public records. An active grant shows funding, not that a study is
          recruiting, and trial status comes from ClinicalTrials.gov and may be out of date.
        </span>
      </p>
      <div className={`grid gap-6 ${limit ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <Column title="Recruiting trials" empty="No recruiting trials match your interests right now.">
          {take(data.trials).map((m) => (
            <RecordMatch key={m.project.id} match={m} terms={terms} />
          ))}
        </Column>
        <Column title="Active grants" empty="No active grants match your interests right now.">
          {take(data.grants).map((m) => (
            <RecordMatch key={m.project.id} match={m} terms={terms} />
          ))}
        </Column>
        <Column title="People to connect with" empty="No researchers share your interests yet.">
          {take(data.collaborators).map((p) => (
            <PersonMatch key={p.researcherId} person={p} terms={terms} college={college} />
          ))}
        </Column>
      </div>
    </div>
  );
}
