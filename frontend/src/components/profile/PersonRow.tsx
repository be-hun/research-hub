import Link from "next/link";
import SaveButton from "@/components/SaveButton";
import { CollegeTag } from "@/components/Tags";
import { count } from "@/lib/format";
import { reasonChips } from "@/lib/matchReasons";
import type { CollaboratorMatch } from "@/lib/types";
import MatchBadge from "./MatchBadge";
import ReasonChips from "./ReasonChips";

export function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "w-10 h-10 text-small", md: "w-12 h-12 text-body", lg: "w-14 h-14 text-h3" }[size];
  return (
    <span
      className={`${box} rounded-full bg-cherry-tint text-cherry font-serif font-semibold flex items-center justify-center shrink-0 select-none`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/**
 * One person who shares the profile's interests. The band and rank come from the backend's single people ranking, so
 * they read the same here, in the full list and on the person's own page. `detailed` adds why they match.
 */
export default function PersonRow({
  person,
  total,
  detailed = false,
}: {
  person: CollaboratorMatch;
  /** Everyone who shares the profile's interests, for "#3 of 312". */
  total?: number;
  detailed?: boolean;
}) {
  const chips = reasonChips(person.reasons);
  const href = `/researchers/${person.researcherId}`;
  const department = person.title && person.title !== "Researcher" ? person.title : "Department not listed";
  return (
    <li className={`flex gap-3 ${detailed ? "py-4" : "py-3"}`}>
      <Avatar initials={person.initials} size={detailed ? "lg" : "md"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="min-w-0 text-body font-semibold leading-snug break-words hover:text-cherry hover:underline underline-offset-2">
            {person.name}
          </Link>
          <MatchBadge band={person.band} score={person.score} chips={chips} rank={person.rank} total={total} />
        </div>
        <p className="text-small text-ink-3 break-words">{department}</p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
          <CollegeTag id={person.college} />
          <span className="text-tiny font-semibold text-ink-2 num">
            #{person.rank.toLocaleString()}
            {total ? <span className="font-normal text-ink-3"> of {total.toLocaleString()}</span> : null}
          </span>
        </div>
        {detailed && (
          <>
            <ReasonChips chips={chips} />
            {person.citations.length > 0 && (
              <p className="text-tiny text-ink-3 mt-1.5">Based on {count(person.citations.length, "public record")}</p>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Link
            href={href}
            className="inline-flex items-center px-3 py-1 rounded-full border border-ink-2 text-small font-semibold text-ink-2 hover:border-cherry hover:text-cherry hover:bg-cherry-tint"
          >
            View profile<span className="sr-only">: {person.name}</span>
          </Link>
          {detailed && (
            <SaveButton compact item={{ kind: "researcher", id: person.researcherId, title: person.name, detail: person.title || undefined }} />
          )}
        </div>
      </div>
    </li>
  );
}
