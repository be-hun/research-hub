import { college, KIND_LABELS } from "@/lib/colleges";
import type { CollegeId, Kind } from "@/lib/types";
import Icon from "./Icon";

export function CollegeTag({ id, short = true }: { id: CollegeId | null | undefined; short?: boolean }) {
  const c = college(id);
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-tiny font-medium text-ink-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} aria-hidden="true" />
      {short ? c.short : c.name}
    </span>
  );
}

type Tone = "go" | "soon" | "running" | "neutral" | "stopped";

// Recruiting is the only state where someone could join a study, so it alone is green. "About to recruit" is amber;
// running-but-closed is blue; finished or unknown is gray; stopped early is red-gray.
const TONES: Record<string, Tone> = {
  Recruiting: "go",
  Active: "go",
  "Not yet recruiting": "soon",
  "Enrolling by invitation": "soon",
  "Active, not recruiting": "running",
  Suspended: "stopped",
  Terminated: "stopped",
  Withdrawn: "stopped",
};

const TONE_CLASSES: Record<Tone, { chip: string; dot?: string }> = {
  go: { chip: "bg-active-bg text-active-ink", dot: "bg-active-ink" },
  soon: { chip: "bg-soon-bg text-soon-ink", dot: "bg-soon-ink" },
  running: { chip: "bg-running-bg text-running-ink", dot: "bg-running-ink" },
  neutral: { chip: "bg-canvas border border-line text-ink-2" },
  stopped: { chip: "bg-canvas border border-line text-stopped-ink" },
};

/**
 * A record's status in the source's own words, colored by what it means for someone hoping to join:
 * green recruiting, amber not yet, blue running but closed, gray over or unknown. `stale` adds a warning when the
 * registry status has outlived the record's end date.
 */
export function StatusChip({ label, active, stale = false }: { label?: string; active: boolean; stale?: boolean }) {
  const text = label ?? (active ? "Active" : "Ended");
  const tone: Tone = text.startsWith("Published") ? "neutral" : TONES[text] ?? (active ? "go" : "neutral");
  const c = TONE_CLASSES[tone];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-tiny font-semibold whitespace-nowrap ${c.chip}`}>
        {c.dot && <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} aria-hidden="true" />}
        {text}
      </span>
      {stale && (
        <span
          className="inline-flex items-center gap-0.5 text-tiny font-medium text-soon-ink whitespace-nowrap"
          title="The registry still lists this status, but the trial's end date has passed. Check ClinicalTrials.gov."
        >
          <Icon name="warning" size={14} />
          May be out of date
        </span>
      )}
    </span>
  );
}

export function SourceTag({ agency }: { agency: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-line-strong text-ink-2 text-tiny font-semibold tracking-wide max-w-[14rem] truncate">
      {agency}
    </span>
  );
}

export function KindTag({ kind }: { kind: Kind }) {
  return (
    <span className="text-tiny font-semibold uppercase tracking-wider text-ink-3">{KIND_LABELS[kind]}</span>
  );
}
