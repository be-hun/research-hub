import { COLLEGES } from "@/lib/colleges";
import type { Opportunity } from "@/lib/types";
import Icon from "./Icon";

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  "research-assistant": "Research Assistant",
  fellowship: "Paid Fellowship",
  credit: "Academic Credit",
  volunteer: "Volunteer / Shadowing",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function OpportunityCard({ opp }: { opp: Opportunity }) {
  return (
    <article className="bg-white rounded-xl border border-outline-variant hover:border-slate-400 p-5 shadow-sm transition-all">
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="px-2 py-0.5 bg-surface-container text-secondary border border-secondary/20 rounded text-label-sm">
          {TYPE_LABEL[opp.type]}
        </span>
        {opp.verifiedByPI && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-label-sm">
            <Icon name="verified" size={13} /> Verified by PI
          </span>
        )}
      </div>
      <div className="text-label-sm text-primary uppercase tracking-wider mb-1">
        {opp.colleges.map((c) => COLLEGES[c].short).join(" & ")}
      </div>
      <h3 className="font-headline text-headline-sm font-bold mb-1">{opp.title}</h3>
      <p className="text-label-sm text-tertiary mb-3">
        <span className="font-medium text-on-surface">{opp.lab}</span> • {opp.sponsor}
      </p>
      <p className="text-body-sm text-tertiary mb-4 line-clamp-3">{opp.description}</p>
      <div className="flex flex-wrap gap-1 mb-4">
        {opp.skills.map((s) => (
          <span key={s} className="px-2 py-0.5 bg-surface-container-low text-tertiary border border-outline-variant rounded text-label-sm">
            {s}
          </span>
        ))}
      </div>
      <div className="pt-3 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-label-sm">
        <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
          <Icon name="payments" size={16} />
          {opp.paid ? `Paid${opp.hourlyRate ? ` ($${opp.hourlyRate.toFixed(2)}/hr)` : ""}` : "Unpaid"} • {opp.hoursPerWeek} hrs/wk
        </span>
        <span className="inline-flex items-center gap-1 text-amber-800">
          <Icon name="schedule" size={16} /> {opp.term} • Apply by {formatDate(opp.deadline)}
        </span>
      </div>
    </article>
  );
}
