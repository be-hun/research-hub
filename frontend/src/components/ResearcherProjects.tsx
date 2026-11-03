import AwardRow from "@/components/AwardRow";
import type { ResearcherProject } from "@/lib/types";

/** Every record on a profile, grouped by start year (newest first). Each title links to the record page,
 *  which links to the original source. */
export default function ResearcherProjects({ projects }: { projects: ResearcherProject[] }) {
  const years = new Map<number, ResearcherProject[]>();
  for (const r of projects) {
    const list = years.get(r.project.startYear) ?? [];
    list.push(r);
    years.set(r.project.startYear, list);
  }
  return (
    <div className="space-y-6">
      {[...years.entries()]
        .sort(([a], [b]) => b - a)
        .map(([year, rows]) => (
          // Record titles inside AwardRow are h3s, so the year is a label rather than another heading level.
          <section key={year} aria-label={`Records starting in ${year}`}>
            <p className="text-h3 num mb-2" aria-hidden="true">
              {year}
            </p>
            <ul className="bg-surface border border-line rounded-xl px-4 sm:px-5">
              {rows.map((r) => (
                <AwardRow
                  key={r.project.id}
                  project={r.project}
                  context={`Role: ${r.role} · Source: ${r.project.source.label}`}
                />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
