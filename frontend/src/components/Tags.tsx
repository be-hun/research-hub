import { college } from "@/lib/colleges";
import type { CollegeId } from "@/lib/types";

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

export function StatusChip({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-active-bg text-active-ink text-tiny font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-active-ink" aria-hidden="true" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-canvas border border-line text-ink-3 text-tiny font-semibold">
      Ended
    </span>
  );
}

export function SourceTag({ agency }: { agency: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-line-strong text-ink-2 text-tiny font-semibold tracking-wide">
      {agency}
    </span>
  );
}
