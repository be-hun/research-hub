import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/Card";
import CollegeChip from "@/components/CollegeChip";
import Icon from "@/components/Icon";
import { getCollaboratorMatches, getProject, getProjects, hasResearcherProfile } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const [related, matches] = await Promise.all([
    getProjects(project.relatedProjectIds),
    getCollaboratorMatches("r-rivera"),
  ]);
  const verified = project.verification === "faculty-confirmed";

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-space-lg">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-body-sm text-tertiary mb-space-md">
        <Link href="/" className="hover:text-primary">Discover</Link>
        <Icon name="chevron_right" size={14} />
        <Link href="/search" className="hover:text-primary">Projects</Link>
        <Icon name="chevron_right" size={14} />
        <span className="text-on-surface font-medium truncate max-w-xl">{project.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 flex flex-col gap-space-lg">
          <section className="relative overflow-hidden bg-surface-container-lowest rounded-xl border border-surface-container-highest p-space-lg">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: COLLEGES[project.colleges[0]].color }} />
            <div className="flex flex-wrap items-center gap-2 pt-1 mb-3">
              {project.colleges.map((c) => (
                <CollegeChip key={c} id={c} />
              ))}
              {project.colleges.length > 1 && (
                <span className="px-2 py-0.5 rounded bg-secondary-container/20 text-secondary text-label-sm border border-secondary/20">
                  Cross-college
                </span>
              )}
              <span
                className={`ml-auto px-2.5 py-0.5 rounded-full text-label-sm border ${
                  verified
                    ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                    : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                }`}
              >
                {verified ? "Faculty confirmed ✓" : "Public award record"}
              </span>
            </div>
            <h1 className="font-headline text-headline-lg mb-3 tracking-tight">{project.title}</h1>
            <p className="text-body-lg text-tertiary">{project.summary}</p>
          </section>

          <Card title="Abstract & Investigation Objectives" icon="description">
            <div className="space-y-3 text-body-md text-tertiary">
              {project.abstract.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {project.methodologies.length > 0 && (
              <div className="mt-5 pt-4 border-t border-surface-container-high">
                <h3 className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Core Methodologies</h3>
                <div className="flex flex-wrap gap-1.5">
                  {project.methodologies.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-lg bg-surface-container-low border border-surface-container-highest text-label-md">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Funding & Provenance"
            icon="account_balance"
            aside={
              <a href={project.source.url} className="text-label-md text-secondary hover:underline inline-flex items-center gap-1">
                Source: {project.source.label} <Icon name="open_in_new" size={14} />
              </a>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                ["Funding Agency", project.funding.agency, project.funding.mechanism && `Mechanism: ${project.funding.mechanism}`],
                ["Award Period", project.funding.period, ""],
                ["Total Authorized", project.funding.total, ""],
                ["Award Number", project.funding.awardNumber, ""],
              ].map(([label, value, sub]) => (
                <div key={label} className="p-3 rounded-lg bg-surface-container-low border border-surface-container-highest">
                  <p className="text-label-sm text-on-surface-variant">{label}</p>
                  <p className="text-label-lg mt-0.5">{value}</p>
                  {sub && <p className="text-xs text-tertiary">{sub}</p>}
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] p-3 text-[#92400E] flex items-start gap-2.5 text-body-sm">
              <Icon name="info" size={18} className="shrink-0 mt-0.5" />
              <p>
                <strong>Award Notice:</strong> An award record shows funding, not that the study is currently active or
                recruiting. Verify with the Principal Investigator.
              </p>
            </div>
          </Card>

          {project.team.length > 0 && (
            <Card title="Investigative Team" icon="groups">
              <div className="space-y-3">
                {project.team.map((m) => (
                  <div key={m.name} className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-surface-container-highest">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary-fixed text-primary font-headline text-headline-sm flex items-center justify-center shrink-0">
                        {m.name.replace("Dr. ", "").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-label-lg font-bold">{m.name}</span>
                          <span className="px-2 py-0.5 rounded bg-surface-container-high text-tertiary text-label-sm">{m.role}</span>
                        </div>
                        <p className="text-body-sm text-tertiary">
                          {m.department} • {COLLEGES[m.college].name}
                        </p>
                      </div>
                    </div>
                    {hasResearcherProfile(m.researcherId) && (
                      <Link
                        href={`/researchers/${m.researcherId}`}
                        className="px-3 py-1.5 rounded-lg border border-surface-container-highest text-label-md hover:bg-surface-container-low"
                      >
                        Faculty Profile
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {related.length > 0 && (
            <Card title="Related Projects Across Colleges" icon="hub">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/projects/${r.id}`}
                    className="relative overflow-hidden p-3.5 pt-4 rounded-lg border border-surface-container-highest hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: COLLEGES[r.colleges[0]].color }} />
                    <h3 className="font-headline text-[16px] leading-snug font-bold mb-2">{r.title}</h3>
                    <p className="text-body-sm text-tertiary pt-2 border-t border-surface-container-high">
                      PI: <strong>{r.pi.name}</strong>
                    </p>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-space-lg lg:sticky lg:top-20">
          <section className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-space-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 rounded bg-[#2F4FD1] text-white">
                <Icon name="auto_awesome" size={18} />
              </span>
              <h2 className="font-headline text-[18px] text-[#1E1B4B] font-bold">Why this matches your search</h2>
            </div>
            <ul className="space-y-3 text-body-sm text-[#1E1B4B]">
              {(project.match ? [project.match.reason] : [project.summary]).map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2F4FD1] mt-2 shrink-0" />
                  <div>
                    <span>{r}</span>
                    <span className="block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-[#E0E7FF] text-[#2F4FD1] border border-[#C7D2FE] w-fit">
                      Source: {project.source.label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <Card title="Potential Collaborators" icon="person_add" aside={<span className="text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-tertiary">AI Suggested</span>}>
            <div className="space-y-3">
              {matches.slice(0, 2).map((m) => (
                <div key={m.researcherId} className="p-3 rounded-lg border border-surface-container-highest bg-surface-container-low">
                  <div className="flex items-center justify-between">
                    <span className="text-label-md font-bold">{m.name}</span>
                    <span className="text-label-sm font-bold" style={{ color: COLLEGES[m.college].color }}>
                      {m.score}% synergy
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {COLLEGES[m.college].name} • {m.title}
                  </p>
                  <p className="text-xs text-tertiary mt-1 italic">&ldquo;{m.reasons[0]}&rdquo;</p>
                </div>
              ))}
            </div>
            <Link
              href="/matches"
              className="mt-4 w-full bg-primary hover:bg-[#821A2B] text-on-primary py-2.5 rounded-lg text-label-md flex items-center justify-center gap-1.5"
            >
              <Icon name="send" size={18} />
              See all matches
            </Link>
          </Card>

          {project.students.skills.length > 0 && (
            <Card title="For Students" icon="school">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1.5">Skills that help this lab</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {project.students.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded bg-surface-container text-xs">{s}</span>
                ))}
              </div>
              {project.students.notice && (
                <div className="p-2.5 rounded bg-surface-container-low border border-surface-container-highest mb-3 text-xs text-tertiary">
                  <strong className="text-on-surface">Active Lab Notice:</strong> {project.students.notice}
                </div>
              )}
              <Link href="/pathways" className="inline-flex items-center gap-1 text-label-md text-primary font-semibold hover:underline">
                Explore Student Research Pathway <Icon name="north_east" size={16} />
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
