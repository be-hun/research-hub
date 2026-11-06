import Link from "next/link";
import { plainReasons, reasonChips } from "@/lib/matchReasons";
import type { ResearcherMatch } from "@/lib/types";
import AwardRow from "./AwardRow";
import MatchBadge from "./profile/MatchBadge";

function EditLink() {
  return (
    <Link href="/account#interests" className="text-cherry underline underline-offset-2">
      Edit your interests
    </Link>
  );
}

/**
 * Demo account only: what the signed-in profile shares with this researcher, from stored records. The band and rank
 * come from the same people ranking as the account page, so they read the same in both places.
 */
export default function YouAndResearcher({ name, match }: { name: string; match: ResearcherMatch }) {
  const matched = match.eligible && match.score > 0;
  return (
    <section aria-labelledby="you-and" className="bg-cherry-tint/60 border border-cherry/20 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="you-and" className="text-h3 break-words">
            You and {name}
          </h2>
          {matched && match.rank != null && (
            <p className="text-small text-ink-2 mt-0.5 num">
              <strong className="text-ink">#{match.rank.toLocaleString()}</strong> of{" "}
              <Link href="/account/people" className="underline underline-offset-2 hover:text-cherry">
                {match.total.toLocaleString()} researchers who share your interests
              </Link>
            </p>
          )}
        </div>
        {matched && (
          <MatchBadge band={match.band} score={match.score} chips={reasonChips(match.reasons)} rank={match.rank} total={match.total} />
        )}
      </div>
      {matched ? (
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
          {match.reasons.length > 0 && <p className="text-small text-ink-2">{plainReasons(match.reasons)}</p>}
          {match.records.length > 0 && (
            <ul className="bg-surface border border-line rounded-lg px-4">
              {match.records.slice(0, 3).map((p) => (
                <AwardRow key={p.id} project={p} />
              ))}
            </ul>
          )}
        </>
      ) : !match.eligible ? (
        <p className="text-small text-ink-2">
          Not in your matches: none of their records are active or recent. <EditLink />
        </p>
      ) : (
        <p className="text-small text-ink-2">
          None of {name}&apos;s active or recent records share your topics or keywords. <EditLink />
        </p>
      )}
      <p className="text-tiny text-ink-3">
        Based on shared topics and keywords in public records. A discovery aid, not a recommendation. Synthetic demo
        account.
      </p>
    </section>
  );
}
