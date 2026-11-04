import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import CountBars from "@/components/charts/CountBars";
import CompatibilitySection from "@/components/CompatibilitySection";
import { ConfidenceChip } from "@/components/ConfidenceNotice";
import Illustration from "@/components/Illustration";
import ResearcherHeader from "@/components/ResearcherHeader";
import ResearcherProjects from "@/components/ResearcherProjects";
import SaveButton from "@/components/SaveButton";
import Section from "@/components/Section";
import SectionTabs from "@/components/SectionTabs";
import { CollegeTag } from "@/components/Tags";
import YouAndResearcher from "@/components/YouAndResearcher";
import { getResearcher, getResearcherCompatibility, matchResearcher } from "@/lib/api";
import { COLLEGES, KIND_LABELS } from "@/lib/colleges";
import { demoProfileInput } from "@/lib/demo";
import { count, shortDate } from "@/lib/format";
import type { Kind } from "@/lib/types";

const EVIDENCE: Record<string, string> = {
  "source-person-id": "Source person ID",
  "name-within-source": "Name, within this source",
  "same-name-across-sources": "Same name only (not confirmed)",
};
const KINDS: Kind[] = ["award", "trial", "publication"];

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const [r, compatibility] = await Promise.all([
    getResearcher(params.id),
    getResearcherCompatibility(params.id),
  ]);
  return { title: r?.name ?? "Researcher" };
}

export default async function ResearcherPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { kind?: string };
}) {
  const demo = demoProfileInput();
  const [r, compatibility, youMatch] = await Promise.all([
    getResearcher(params.id),
    getResearcherCompatibility(params.id),
    demo ? matchResearcher(params.id, demo).catch(() => null) : null,
  ]);
  if (!r) notFound();
  const kind = KINDS.find((k) => k === searchParams.kind);
  const shown = kind ? r.projects.filter((p) => p.project.kind === kind) : r.projects;
  const kindCount = { award: r.counts.grants, trial: r.counts.trials, publication: r.counts.publications };

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <nav aria-label="Breadcrumb" className="text-small text-ink-3 min-w-0">
          <Link href="/researchers" className="hover:text-ink">People</Link>
          {r.college && (
            <>
              {" "}<span aria-hidden="true">/</span>{" "}
              <Link href={`/researchers?college=${r.college}`} className="hover:text-ink">{COLLEGES[r.college].short}</Link>
            </>
          )}{" "}
          <span aria-hidden="true">/</span> <span className="text-ink-2">{r.name}</span>
        </nav>
        {demo && (
          <SaveButton
            item={{ kind: "researcher", id: r.id, title: r.name, detail: [r.college && COLLEGES[r.college].short, r.department].filter(Boolean).join(" · ") }}
          />
        )}
      </div>

      <ResearcherHeader profile={r} />

      {youMatch && <YouAndResearcher name={r.name} match={youMatch} />}

      <SectionTabs
        label="On this profile"
        items={[
          { id: "overview", label: "Overview" },
          { id: "records", label: `Records (${r.projects.length})` },
          { id: "listed-with", label: `Listed with (${r.collaborators.length})` },
          { id: "sources", label: "Sources" },
        ]}
      />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-10">
        <div className="space-y-12 min-w-0">
          <Section id="overview" title="Overview" subtitle="What these records are about, and when they started">
            <div className="space-y-8">
              {r.focus.length > 0 && (
                <div>
                  <h3 className="text-small font-semibold text-ink mb-3">Research focus</h3>
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {r.focus.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/topics/${f.id}`}
                          className="flex items-center gap-3 p-2 pr-3 rounded-lg bg-surface border border-line hover:border-cherry group h-full"
                        >
                          {f.image ? (
                            <span className="relative w-11 h-11 rounded-md overflow-hidden shrink-0">
                              <Image src={f.image} alt="" fill sizes="44px" className="object-cover" />
                            </span>
                          ) : (
                            <span className="w-11 h-11 rounded-md bg-canvas shrink-0" aria-hidden="true" />
                          )}
                          <span className="min-w-0">
                            <span className="block text-small font-medium leading-snug group-hover:text-cherry">{f.name}</span>
                            <span className="block text-tiny text-ink-3 num">{count(f.records, "record")}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {r.terms.length > 0 && (
                    <p className="text-small text-ink-3 mt-3">Frequent subject terms: {r.terms.join(" · ")}</p>
                  )}
                </div>
              )}
              {r.byYear.length > 0 && (
                <div>
                  <h3 className="text-small font-semibold text-ink mb-3">Records by start year</h3>
                  <CountBars years={r.byYear} caption={`${r.name}: records by start year and type`} />
                </div>
              )}
            </div>
          </Section>
          {compatibility && <CompatibilitySection compatibility={compatibility} />}

          <Section id="records" title="Research records" subtitle="Grouped by start year, newest first. Each opens the record and its original source.">
            <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter records by type">
              {[undefined, ...KINDS].map((k) => {
                const on = k === kind;
                const n = k ? kindCount[k] : r.projects.length;
                if (k && n === 0) return null;
                return (
                  <Link
                    key={k ?? "all"}
                    href={k ? `?kind=${k}#records` : "?#records"}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`px-3 py-1.5 rounded-full text-small border ${on ? "bg-ink text-white border-ink" : "bg-surface border-line text-ink-2 hover:border-ink-3"}`}
                  >
                    {k ? `${KIND_LABELS[k]}s` : "All"} <span className="num opacity-70">{n}</span>
                  </Link>
                );
              })}
            </div>
            <ResearcherProjects projects={shown} />
          </Section>
        </div>

        <aside className="space-y-12 min-w-0">
          <Section id="listed-with" title="Listed with" subtitle="People named on the same records">
            {r.collaborators.length === 0 ? (
              <div className="text-center bg-surface border border-line rounded-xl px-4 py-6">
                <Illustration variant="people" className="w-40 mx-auto" />
                <p className="text-small text-ink-3 mt-1">No one else from Temple is named on these records.</p>
              </div>
            ) : (
              <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
                {r.collaborators.map((c) => (
                  <li key={c.researcherId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/researchers/${c.researcherId}`} className="font-medium hover:text-cherry">
                        {c.name}
                      </Link>
                      <span className="text-tiny text-ink-3 num shrink-0">{count(c.sharedRecords, "shared record")}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-ink-3 mt-1">
                      <CollegeTag id={c.college} />
                      {c.crossCollege && (
                        <span className="px-1.5 py-0.5 rounded bg-canvas border border-line font-semibold text-ink-2">Different college</span>
                      )}
                      {c.department && <span>{c.department}</span>}
                      {c.identityConfidence !== "high" && <ConfidenceChip confidence={c.identityConfidence} />}
                    </div>
                    <details className="text-tiny text-ink-3 mt-1">
                      <summary className="cursor-pointer hover:text-ink">Shared records</summary>
                      <ul className="mt-1 space-y-0.5">
                        {c.projectIds.map((id) => {
                          const p = r.projects.find((x) => x.project.id === id)?.project;
                          return (
                            <li key={id}>
                              <Link href={`/projects/${id}`} className="underline underline-offset-2 hover:text-cherry">
                                {p?.title ?? id}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="sources" title="Sources" subtitle="Where every record on this profile comes from">
            <div className="space-y-4 text-small text-ink-2">
              <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
                {r.sources.map((s) => (
                  <li key={s.label} className="px-4 py-3 flex flex-wrap justify-between gap-x-3">
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-cherry underline underline-offset-2">
                      {s.label}
                    </a>
                    <span className="text-ink-3 num">
                      {count(s.records, "record")}
                      {s.lastSeen ? ` · updated ${shortDate(s.lastSeen)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p>{r.about}</p>
              <details>
                <summary className="cursor-pointer font-semibold text-ink">How this profile was assembled</summary>
                <table className="mt-2 w-full text-tiny">
                  <caption className="sr-only">Source identities combined into this profile</caption>
                  <thead>
                    <tr className="text-left text-ink-3">
                      <th className="font-semibold py-1 pr-2">Source</th>
                      <th className="font-semibold py-1 pr-2">Name as listed</th>
                      <th className="font-semibold py-1">Matched by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.aliases.map((a) => (
                      <tr key={`${a.source}-${a.name}-${a.sourcePersonId}`} className="border-t border-line align-top">
                        <td className="py-1 pr-2">{a.source}</td>
                        <td className="py-1 pr-2">{a.name}</td>
                        <td className="py-1">
                          {EVIDENCE[a.evidence]}
                          {a.sourcePersonId ? ` (${a.sourcePersonId})` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <p className="text-tiny text-ink-3">
                Grant records are funding history, not proof that research is active. Counts include NIH center-grant
                components this person is listed on, which college and topic totals count once under the parent award.
              </p>
            </div>
          </Section>
        </aside>
      </div>
    </main>
  );
}
