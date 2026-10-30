import { college, KIND_LABELS } from "@/lib/colleges";
import type { CollegeId, Kind } from "@/lib/types";

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

const ACTIVE_LABELS = new Set(["Active", "Recruiting", "Not yet recruiting", "Enrolling by invitation", "Active, not recruiting"]);

/** A record's status in the source's own words. Green means running; gray means over or unknown. */
export function StatusChip({ label, active }: { label?: string; active: boolean }) {
  const text = label ?? (active ? "Active" : "Ended");
  if (text.startsWith("Published")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-canvas border border-line text-ink-2 text-tiny font-semibold">
        {text}
      </span>
    );
  }
  return active || ACTIVE_LABELS.has(text) ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-active-bg text-active-ink text-tiny font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-active-ink" aria-hidden="true" />
      {text}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-canvas border border-line text-ink-3 text-tiny font-semibold">
      {text}
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
