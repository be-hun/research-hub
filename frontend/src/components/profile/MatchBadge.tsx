import Icon from "@/components/Icon";
import { SCORE_PARTS, type ReasonChip } from "@/lib/matchReasons";
import BandPill from "./BandPill";

/**
 * A match's band, with the points behind it one click away. The parts mirror `_score` in backend/app/compatibility.py;
 * only the parts that applied to this match are listed, each with the most it can add. `rank` and `total` add the
 * person's place among everyone who shares the profile's interests.
 */
export default function MatchBadge({
  band,
  score,
  chips,
  rank,
  total,
  align = "right",
}: {
  band: string | null | undefined;
  score: number;
  chips: ReasonChip[];
  rank?: number | null;
  total?: number;
  /** Which edge of the badge the popover lines up with; "left" for badges near the left edge of the screen. */
  align?: "left" | "right";
}) {
  const topics = chips.filter((c) => c.kind === "topic");
  const keywords = chips.filter((c) => c.kind === "keyword");
  const source = chips.find((c) => c.kind === "source");
  return (
    <details className="relative shrink-0">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer inline-flex items-center gap-0.5 rounded-full hover:opacity-90">
        <BandPill band={band} />
        <Icon name="info" size={16} className="text-ink-3" />
        <span className="sr-only">. How this match is built</span>
      </summary>
      <div
        className={`absolute ${align === "right" ? "right-0" : "left-0"} z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-3 shadow-card text-tiny text-ink-2`}
      >
        <p className="font-semibold text-ink">How this match is built</p>
        <p className="mt-0.5 mb-1.5 num">
          {score} of 100 points{band ? ` · ${band}` : ""}
          {rank && total ? ` · #${rank.toLocaleString()} of ${total.toLocaleString()}` : ""}
        </p>
        <ul className="space-y-1">
          {topics.length > 0 && (
            <li>
              <span className="text-ink font-medium">Shared topics</span> ({SCORE_PARTS.topics}): {topics.map((t) => t.label).join("; ")}
              {source && <span className="text-ink-3"> · {source.label}</span>}
            </li>
          )}
          {keywords.length > 0 && (
            <li>
              <span className="text-ink font-medium">Shared interests</span> ({SCORE_PARTS.keywords}): {keywords.map((k) => k.label).join(", ")}
            </li>
          )}
          {chips.some((c) => c.key === "c:same") && (
            <li>
              <span className="text-ink font-medium">Same college</span> ({SCORE_PARTS.sameCollege})
            </li>
          )}
          {chips.some((c) => c.key === "c:other") && (
            <li>
              <span className="text-ink font-medium">Different college</span> ({SCORE_PARTS.otherCollege})
            </li>
          )}
        </ul>
        <p className="mt-2 text-ink-3">
          {SCORE_PARTS.bands}. Counted from topics and whole-phrase interests in public records; a shared college alone
          never counts, and matches under {SCORE_PARTS.minimum} points aren&apos;t shown. It measures overlap, not
          quality or fit. No AI is involved.
        </p>
      </div>
    </details>
  );
}
