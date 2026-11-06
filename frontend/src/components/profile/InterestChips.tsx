import Link from "next/link";
import { count } from "@/lib/format";
import type { TopicSummary } from "@/lib/types";

/** Every record tagged with a topic: grants, trials and papers, as /api/topics counts them. */
export const topicRecords = (t: TopicSummary) => t.awards + t.trials + t.publications;

/** The read-only view of the profile's interests: topics with their record counts, then keywords as skills. */
export default function InterestChips({ topics, terms }: { topics: TopicSummary[]; terms: string[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-sans text-small font-semibold text-ink mb-2">Topics</h3>
        {topics.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Your topics">
            {topics.map((t) => (
              <li key={t.id} className="max-w-full">
                <Link
                  href={`/topics/${t.id}`}
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-cherry-tint text-cherry-dark pl-3 pr-1.5 py-1 text-small font-medium hover:bg-cherry hover:text-white group"
                >
                  <span className="break-words min-w-0">{t.name}</span>
                  <span className="rounded-full bg-surface/80 text-ink-2 px-2 py-0.5 text-tiny font-semibold num whitespace-nowrap group-hover:bg-white/20 group-hover:text-white">
                    {count(topicRecords(t), "record")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-3">No topics yet. Add one to see matching trials, grants and people.</p>
        )}
      </div>
      <div>
        <h3 className="font-sans text-small font-semibold text-ink mb-2">Keywords</h3>
        {terms.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Your keywords">
            {terms.map((term) => (
              <li
                key={term}
                className="inline-flex max-w-full items-center rounded-full border border-line-strong bg-surface px-3 py-1 text-small font-semibold text-ink-2 break-words"
              >
                {term}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-3">No keywords yet.</p>
        )}
        <p className="text-tiny text-ink-3 mt-3">
          Keywords match whole phrases in record titles, abstracts and subject terms.
        </p>
      </div>
    </div>
  );
}
