import Icon from "@/components/Icon";
import { deadlineLabel, STATUS_LABELS, type DeadlineTone } from "@/lib/opportunities";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

// Open is the only state someone can apply in, so it alone is green; forecasted is amber; closed is gray.
const STATUS_CLASSES: Record<OpportunityStatus, { chip: string; dot?: string }> = {
  posted: { chip: "bg-active-bg text-active-ink", dot: "bg-active-ink" },
  forecasted: { chip: "bg-soon-bg text-soon-ink", dot: "bg-soon-ink" },
  closed: { chip: "bg-canvas border border-line text-ink-2" },
};

export function OpportunityStatusChip({ status }: { status: OpportunityStatus }) {
  const c = STATUS_CLASSES[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-tiny font-semibold whitespace-nowrap ${c.chip}`}>
      {c.dot && <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} aria-hidden="true" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

const DEADLINE_CLASSES: Record<DeadlineTone, string> = {
  urgent: "bg-cherry-tint text-cherry-dark border border-cherry/30",
  open: "bg-surface text-ink border border-line-strong",
  estimated: "bg-surface text-soon-ink border border-dashed border-soon-ink/50",
  none: "bg-canvas text-ink-2 border border-line",
  closed: "bg-canvas text-ink-3 border border-line",
};

/** The deadline in words, from the call's own date. Under two weeks it turns cherry with a warning icon. */
export function DeadlineBadge({
  opportunity,
  size = "md",
}: {
  opportunity: Pick<Opportunity, "status" | "closeDate" | "closeDateEstimated" | "daysLeft">;
  size?: "md" | "lg";
}) {
  const d = deadlineLabel(opportunity);
  const showDate = d.date && (d.tone === "urgent" || d.tone === "open");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${size === "lg" ? "px-3 py-1.5 text-body" : "px-2 py-0.5 text-tiny"} ${DEADLINE_CLASSES[d.tone]}`}
      title={showDate ? `Application deadline: ${d.date}` : undefined}
    >
      {d.tone === "urgent" && <Icon name="warning" size={size === "lg" ? 18 : 14} />}
      <span>{d.text}</span>
    </span>
  );
}

export function UniversitiesTag() {
  return (
    <span className="inline-flex items-center gap-1 text-tiny font-medium text-active-ink whitespace-nowrap">
      <Icon name="check" size={14} />
      Open to universities
    </span>
  );
}
