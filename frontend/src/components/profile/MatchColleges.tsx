import BarList, { type BarRow } from "@/components/charts/BarList";
import { COLLEGES } from "@/lib/colleges";
import { count } from "@/lib/format";
import type { CollaboratorMatch, CollegeId, CompatibilityMatch } from "@/lib/types";

/**
 * Colleges across the top matches: each person counts once for their own college, each record once for every college
 * it lists. The counts cover only the matches passed in (the top of each list), so the chart says so.
 */
export default function MatchColleges({ people, records }: { people: CollaboratorMatch[]; records: CompatibilityMatch[] }) {
  const tally = new Map<CollegeId, { people: number; records: number }>();
  const bump = (id: CollegeId, key: "people" | "records") => {
    const t = tally.get(id) ?? { people: 0, records: 0 };
    t[key] += 1;
    tally.set(id, t);
  };
  people.forEach((p) => p.college && bump(p.college, "people"));
  records.forEach((m) => m.project.colleges.forEach((c) => bump(c, "records")));
  const noCollegePeople = people.filter((p) => !p.college).length;
  const noCollegeRecords = records.filter((m) => m.project.colleges.length === 0).length;

  const rows: BarRow[] = Array.from(tally.entries())
    .map(([id, t]) => ({
      key: id,
      label: COLLEGES[id].short,
      href: `/colleges/${id}`,
      color: COLLEGES[id].color,
      value: t.people + t.records,
      valueLabel: (t.people + t.records).toLocaleString(),
      detail: [t.people && count(t.people, "person", "people"), t.records && count(t.records, "record")].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const unplaced = [
    noCollegePeople && count(noCollegePeople, "person", "people"),
    noCollegeRecords && count(noCollegeRecords, "record"),
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      {rows.length ? (
        <BarList rows={rows} caption="Colleges among your top matches: people and records" />
      ) : (
        <p className="text-small text-ink-3">None of your top matches lists a Temple college.</p>
      )}
      <p className="text-tiny text-ink-3">
        Counted across your top {count(people.length, "person", "people")} and {count(records.length, "trial or grant", "trials and grants")}.
        {unplaced.length > 0 && <> Not shown: {unplaced.join(" and ")} with no Temple college listed.</>}
      </p>
    </div>
  );
}
