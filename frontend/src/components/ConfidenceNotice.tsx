import type { IdentityConfidence } from "@/lib/types";

const LABELS: Record<IdentityConfidence, string> = {
  high: "Single-source identity",
  medium: "Name match within one source",
  low: "Name match across sources",
};

/** Small label for lists. Text, not just color, carries the meaning. */
export function ConfidenceChip({ confidence }: { confidence: IdentityConfidence }) {
  const cls =
    confidence === "high" ? "bg-canvas border border-line text-ink-2" : "bg-notice-bg text-notice-ink";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-tiny font-semibold ${cls}`}>
      {LABELS[confidence]}
    </span>
  );
}

/** How sure we are that every record on a profile is the same person, and that nobody confirmed it. */
export default function ConfidenceNotice({
  confidence,
  note,
  verified,
}: {
  confidence: IdentityConfidence;
  note: string;
  verified: boolean;
}) {
  const caution = confidence !== "high";
  return (
    <aside
      aria-label="Identity confidence"
      className={`rounded-xl px-4 py-3 text-small ${caution ? "bg-notice-bg text-notice-ink" : "bg-surface border border-line text-ink-2"}`}
    >
      <p className="font-semibold">
        {LABELS[confidence]}
        <span className="font-normal"> · {verified ? "Confirmed by the researcher" : "Not confirmed by the researcher"}</span>
      </p>
      <p className="mt-1">{note}</p>
    </aside>
  );
}
