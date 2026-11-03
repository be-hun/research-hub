import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AwardRow from "@/components/AwardRow";
import YearBars from "@/components/charts/YearBars";
import Section from "@/components/Section";
import { CollegeTag, KindTag, SourceTag, StatusChip } from "@/components/Tags";
import { getProject, getProjects } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { FUNDER_SERIES } from "@/lib/series";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProject(params.id);
  return { title: p?.title ?? "Record" };
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();
  const related = await getProjects(project.relatedProjectIds);

  const funderColor = FUNDER_SERIES.find((s) => s.label === project.agency)?.color ?? FUNDER_SERIES[2].color;
  // Fill fiscal years with no record so the axis never implies continuous funding.
  const years = project.fundingByYear.map((y) => y.fiscalYear);
  const yearData = years.length
    ? Array.from({ length: Math.max(...years) - Math.min(...years) + 1 }, (_, i) => {
        const fy = Math.min(...years) + i;
        const row = project.fundingByYear.find((y) => y.fiscalYear === fy);
        return { year: fy, values: { amount: row?.amount ?? 0 }, missing: !row };
      })
    : [];
  const noun = { award: "grant", trial: "trial", publication: "paper" }[project.kind];
  const lead = project.kind === "publication" ? "Temple authors" : project.kind === "trial" ? "Study official" : "Led by";

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-10">
      <nav aria-label="Breadcrumb" className="text-small text-ink-3">
        <Link href={`/search?kind=${project.kind}`} className="hover:text-ink">
          {{ award: "Grants", trial: "Clinical trials", publication: "Publications" }[project.kind]}
        </Link>{" "}
        <span aria-hidden="true">/</span> <span className="text-ink-2">{project.facts[project.facts.length - 1]?.value}</span>
      </nav>

      <header className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <KindTag kind={project.kind} />
          {project.colleges.map((c) => (
            <CollegeTag key={c} id={c} short={false} />
          ))}
          {project.kind === "award" && <SourceTag agency={project.agency} />}
        </div>
        <h1 className="text-[30px] leading-[38px] sm:text-h1">{project.title}</h1>
        {project.pi.name && (
          <p className="text-small text-ink-3 mt-3">
            {lead} <span className="text-ink font-medium">{project.pi.name}</span>
            {project.pi.department ? `, ${project.pi.department}` : ""}
          </p>
        )}
        {project.topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.topics.map((t) => (
              <Link
                key={t.id}
                href={`/topics/${t.id}`}
                className="text-small px-3 py-1 rounded-full bg-surface border border-line hover:border-cherry hover:text-cherry"
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line border border-line rounded-xl overflow-hidden">
        {project.facts.map((f) => (
          <div key={f.label} className="bg-surface px-4 py-3 min-w-0">
            <dt className="text-tiny text-ink-3 mb-1">{f.label}</dt>
            <dd className="text-small font-medium break-words">
              {f.label === "Status" ? (
                <StatusChip label={f.value} active={project.active} />
              ) : f.href ? (
                <a href={f.href} target="_blank" rel="noreferrer" className="num text-cherry underline underline-offset-2">
                  {f.value} ↗
                </a>
              ) : (
                f.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-12">
        <div className="space-y-10">
          <Section title={`About this ${noun}`}>
            <div className="space-y-4 text-body text-ink-2 max-w-[70ch]">
              <p className="text-lead text-ink">{project.summary}</p>
              {project.abstract.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-small font-medium text-cherry">
                    {project.kind === "trial" ? "Read the full description" : "Read the full abstract"}
                  </summary>
                  <div className="space-y-4 mt-3">
                    {project.abstract.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Section>

          {related.length > 0 && (
            <Section title="Related research">
              <ul className="bg-surface border border-line rounded-xl px-5">
                {related.map((p) => (
                  <AwardRow key={p.id} project={p} />
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="space-y-10">
          {yearData.length > 0 && (
            <Section title="Funding by year">
              <YearBars
                caption="Money obligated to this award by fiscal year"
                series={[{ key: "amount", label: project.agency, color: funderColor }]}
                data={yearData}
                height={150}
              />
            </Section>
          )}

          {project.funders.length > 0 && (
            <Section title={project.kind === "trial" ? "Sponsors" : "Funders"}>
              <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
                {project.funders.map((f) => (
                  <li key={f.name} className="px-4 py-3">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-tiny text-ink-3">{f.type}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {project.team.length > 0 && (
          <Section title={project.kind === "publication" ? "Temple authors" : "Team"}>
            <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
              {project.team.map((m) => (
                <li key={`${m.name}-${m.role}`} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={m.researcherId ? `/researchers/${m.researcherId}` : `/search?q=${encodeURIComponent(m.name)}`}
                      className="font-medium hover:text-cherry"
                    >
                      {m.name}
                    </Link>
                    <span className="text-tiny text-ink-3">{m.role}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-tiny text-ink-3 mt-0.5">
                    <CollegeTag id={m.college} />
                    {m.department && <span>{m.department}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
          )}

          <p className="text-small text-ink-3">
            {project.students.notice} Record from{" "}
            <a href={project.source.url} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
              {project.source.label}
            </a>
            {project.updatedAt ? `, updated ${shortDate(project.updatedAt)}` : ""}.
            {project.kind === "award" ? ` Latest-year amount: ${money(project.amount)}.` : ""}
          </p>
        </aside>
      </div>
    </main>
  );
}
