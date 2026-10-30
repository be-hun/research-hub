import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/Card";
import CollegeChip from "@/components/CollegeChip";
import Icon from "@/components/Icon";
import { getCollaboratorMatches, getProjects, getResearcher } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";

export default async function ResearcherPage({ params }: { params: { id: string } }) {
  const r = await getResearcher(params.id);
  if (!r) notFound();

  const [projects, matches] = await Promise.all([getProjects(r.projectIds), getCollaboratorMatches(r.id)]);

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-6 flex flex-col gap-6">
      <section className="bg-surface-container-lowest rounded-xl border border-surface-container overflow-hidden shadow-sm">
        <div className="h-36 w-full bg-gradient-to-r from-primary via-primary-container to-[#4a0d18]" />
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-14 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="w-28 h-28 rounded-xl bg-surface-container-lowest p-1 shadow-md border border-surface-container shrink-0">
                <div className="w-full h-full rounded-lg bg-surface-container flex items-center justify-center text-primary-container font-headline font-bold text-3xl">
                  {r.initials}
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5 mb-1">
                  <h1 className="font-headline text-headline-lg">{r.name}</h1>
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] text-label-md px-2.5 py-0.5 rounded-full">
                      <Icon name="verified" size={14} /> Faculty confirmed
                    </span>
                  )}
                </div>
                <p className="text-body-md text-tertiary font-medium">{r.title}</p>
              </div>
            </div>
            <button className="bg-primary-container hover:bg-primary text-on-primary px-4 py-2 rounded-lg text-label-lg flex items-center gap-1.5 self-start md:self-auto">
              <Icon name="mail" size={18} /> Request Introduction
            </button>
          </div>
          <div className="pt-3 border-t border-surface-container flex flex-wrap items-center justify-between gap-3 text-body-sm">
            <CollegeChip id={r.college} />
            {r.orcid && (
              <a href={`https://orcid.org/${r.orcid}`} className="text-secondary hover:underline font-mono text-xs inline-flex items-center gap-0.5">
                ORCID: {r.orcid} <Icon name="open_in_new" size={14} />
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="bg-[#eef2ff] border border-[#c7d2fe] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-secondary text-on-secondary flex items-center justify-center">
                <Icon name="auto_awesome" size={18} />
              </div>
              <h2 className="font-headline text-headline-sm text-[#1e1b4b]">AI Synthesized Research Summary</h2>
            </div>
            <p className="text-body-md text-[#1e1b4b]/90 mb-4">{r.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.focus.map((f) => (
                <span key={f} className="bg-white text-[#312e81] border border-[#c7d2fe] px-2.5 py-1 rounded-md text-label-md">
                  {f}
                </span>
              ))}
            </div>
          </section>

          <Card title="About & Research Agenda" icon="menu_book">
            <p className="text-body-md text-on-surface-variant">{r.about}</p>
          </Card>

          <Card title="Active & Recent Projects" icon="science">
            <div className="space-y-4">
              {projects.map((p) => (
                <article key={p.id} className="p-4 rounded-lg border border-surface-container bg-surface hover:border-[#cbd5e1] transition-all">
                  <h3 className="font-headline text-[17px] leading-snug mb-2">
                    <Link href={`/projects/${p.id}`} className="hover:text-primary">{p.title}</Link>
                  </h3>
                  <p className="text-body-sm text-tertiary">
                    {p.funder} • {p.startYear}–{p.endYear} •{" "}
                    <a href={p.source.url} className="text-secondary hover:underline">Source: {p.source.label}</a>
                  </p>
                </article>
              ))}
            </div>
          </Card>

          <Card title="Selected Peer-Reviewed Publications" icon="auto_stories">
            <div className="divide-y divide-surface-container">
              {r.publications.map((pub) => (
                <div key={pub.doi} className="py-3 first:pt-0 last:pb-0">
                  <h3 className="text-body-md font-semibold leading-snug">{pub.title}</h3>
                  <p className="text-body-sm text-tertiary mt-1">{pub.authors}</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    <span className="italic text-on-surface">{pub.venue}</span> • {pub.year} •{" "}
                    <a href={`https://doi.org/${pub.doi}`} className="font-mono text-secondary hover:underline">doi:{pub.doi}</a>
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-6">
          <Card title="Collaborator Suggestions" icon="hub">
            <div className="space-y-3.5">
              {matches.slice(0, 3).map((m) => (
                <div key={m.researcherId} className="p-3 rounded-lg border border-surface-container bg-surface">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-body-md font-semibold">{m.name}</h3>
                      <p className="text-[11px] text-tertiary font-medium">{COLLEGES[m.college].name}</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      {m.score}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-tertiary">
                    <strong className="text-on-surface font-medium">Why:</strong> {m.reasons[0]}
                  </p>
                </div>
              ))}
            </div>
            <Link href="/matches" className="mt-3 inline-block text-label-md text-primary font-semibold hover:underline">
              View all matches
            </Link>
          </Card>

          {r.accepting && (
            <Card title="Mentorship & Inquiries" icon="school">
              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Currently Accepting Lab Applicants
                </div>
                <p className="text-xs text-on-surface-variant">{r.accepting}</p>
              </div>
              <button className="w-full border border-surface-container-highest hover:bg-surface-container text-tertiary py-2 rounded text-label-md">
                Submit Student Inquiry Form
              </button>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
