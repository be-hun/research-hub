import { COLLEGES } from "@/lib/colleges";
import type { CollegeId } from "@/lib/types";

export default function CollegeChip({ id, short = false }: { id: CollegeId | null; short?: boolean }) {
  const c = id ? COLLEGES[id] : undefined;
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-on-surface text-label-sm border border-surface-container-highest">
      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
      {short ? c.short : c.name}
    </span>
  );
}
