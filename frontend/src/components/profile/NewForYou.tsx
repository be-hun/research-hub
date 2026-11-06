import type { CompatibilityMatch, ForYou } from "@/lib/types";
import FeedCard from "./FeedCard";

const FIRST = 6;

/**
 * Trials and grants taken in turn, so the feed mixes both. Each list arrives best first; the feed starts with
 * whichever list's best match scores higher.
 */
export function interleave(trials: CompatibilityMatch[], grants: CompatibilityMatch[]): CompatibilityMatch[] {
  const [a, b] = (grants[0]?.score ?? 0) > (trials[0]?.score ?? 0) ? [grants, trials] : [trials, grants];
  const out: CompatibilityMatch[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

/** The "New for you" feed: recruiting trials and active grants from POST /api/for-you, as cards. */
export default function NewForYou({ data }: { data: ForYou }) {
  const feed = interleave(data.trials, data.grants);
  const first = feed.slice(0, FIRST);
  const rest = feed.slice(FIRST);
  return (
    <div className="space-y-3">
      {first.map((m) => (
        <FeedCard key={m.project.id} match={m} />
      ))}
      {rest.length > 0 && (
        <details className="group space-y-3">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded-lg border border-dashed border-line-strong px-4 py-2.5 text-center text-small font-semibold text-ink-2 hover:border-cherry hover:text-cherry group-open:hidden">
            Show {rest.length} more
          </summary>
          {rest.map((m) => (
            <FeedCard key={m.project.id} match={m} />
          ))}
        </details>
      )}
      {/* The empty states from the For-you lists: say which half has nothing, and why. */}
      {data.trials.length === 0 && (
        <p className="rounded-lg bg-canvas border border-line p-4 text-small text-ink-3">
          No recruiting trial shares your topics or interests right now. Trials linked to your college alone aren’t listed.
        </p>
      )}
      {data.grants.length === 0 && (
        <p className="rounded-lg bg-canvas border border-line p-4 text-small text-ink-3">
          No active grants match your interests right now.
        </p>
      )}
    </div>
  );
}
