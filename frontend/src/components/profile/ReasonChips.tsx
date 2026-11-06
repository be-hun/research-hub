import type { ReasonChip } from "@/lib/matchReasons";

/**
 * Why something matches, as chips: shared topics in cherry, the profile's own keywords as "Your interest: …", and
 * the college note in gray. How a topic was tagged ("source") belongs in the score details, so it isn't shown.
 */
export default function ReasonChips({ chips, className = "mt-2" }: { chips: ReasonChip[]; className?: string }) {
  const shown = chips.filter((c) => c.kind !== "source");
  if (!shown.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Why this matches">
      {shown.map((c) => (
        <li
          key={c.key}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium max-w-full break-words ${
            c.kind === "topic"
              ? "bg-cherry-tint text-cherry-dark"
              : c.kind === "keyword"
                ? "bg-surface border border-line-strong text-ink-2"
                : "bg-canvas border border-line text-ink-3"
          }`}
        >
          {c.kind === "keyword" && <span className="text-ink-3">Your interest:</span>}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
