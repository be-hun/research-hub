import Link from "next/link";
import type { ResearcherMatch } from "@/lib/types";
import AwardRow from "./AwardRow";

/** Demo account only: what the signed-in profile shares with this researcher, from stored records. */
export default function YouAndResearcher({ name, match }: { name: string; match: ResearcherMatch }) {
  return (
    <section aria-labelledby="you-and" className="bg-cherry-tint/60 border border-cherry/20 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="you-and" className="text-h3">
          You and {name}
        </h2>
        {match.score > 0 && <span className="text-small font-semibold text-cherry num">{match.score}/100 match</span>}
      </div>
      {match.score > 0 ? (
        <>
          {match.sharedTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-small">
              <span className="text-ink-2">Shared topics</span>
              {match.sharedTopics.map((t) => (
                <Link key={t.id} href={`/topics/${t.id}`} className="px-3 py-1 rounded-full bg-surface border border-line hover:border-cherry hover:text-cherry">
                  {t.name}
                </Link>
              ))}
            </div>
          )}
          {match.reasons.length > 0 && <p className="text-small text-ink-2">{match.reasons.join(" · ")}</p>}
          {match.records.length > 0 && (
            <ul className="bg-surface border border-line rounded-lg px-4">
              {match.records.slice(0, 3).map((p) => (
                <AwardRow key={p.id} project={p} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-small text-ink-2">
          None of {name}&apos;s public records share your topics or keywords.{" "}
          <Link href="/account" className="text-cherry underline underline-offset-2">
            Edit your interests
          </Link>
        </p>
      )}
      <p className="text-tiny text-ink-3">Based on shared topics and keywords in public records. Synthetic demo account.</p>
    </section>
  );
}
