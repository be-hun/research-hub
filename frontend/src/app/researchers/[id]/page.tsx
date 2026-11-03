import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfidenceNotice, { ConfidenceChip } from "@/components/ConfidenceNotice";
import ResearcherHeader from "@/components/ResearcherHeader";
import ResearcherProjects from "@/components/ResearcherProjects";
import ResearcherStats from "@/components/ResearcherStats";
import Section from "@/components/Section";
import { CollegeTag } from "@/components/Tags";
import { getResearcher } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { count, shortDate } from "@/lib/format";

const EVIDENCE: Record<string, string> = {
  "source-person-id": "Source person ID",
  "name-within-source": "Name, within this source",
  "same-name-across-sources": "Same name only (not confirmed)",
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const r = await getResearcher(params.id);
  return { title: r?.name ?? "Researcher" };
}

export default async function ResearcherPage({ params }: { params: { id: string } }) {
  const r = await getResearcher(params.id);
  if (!r) notFound();

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-10">
      <nav aria-label="Breadcrumb" className="text-small text-ink-3">
        {r.college ? (
          <Link href={`/colleges/${r.college}`} className="hover:text-ink">
            {COLLEGES[r.college].short}
          </Link>
        ) : (
          <Link href="/search" className="hover:text-ink">
            Search
          </Link>
        )}{" "}
        <span aria-hidden="true">/</span> <span className="text-ink-2">{r.name}</span>
      </nav>

      <ResearcherHeader profile={r} />
      <ConfidenceNotice confidence={r.identityConfidence} note={r.identityNote} verified={r.verified} />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-10">
        <div className="space-y-10 min-w-0">
          <Section title="Record counts" subtitle="Every public record this profile is listed on">
            <ResearcherStats counts={r.counts} />
          </Section>

          <Section title="Research records" subtitle="Grouped by start year, newest first">
            <ResearcherProjects projects={r.projects} />
          </Section>
        </div>

        <aside className="space-y-10 min-w-0">
          {(r.focus.length > 0 || r.terms.length > 0) && (
            <Section title="Research focus" subtitle="Topics and subject terms of these records">
              {r.focus.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {r.focus.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`/topics/${f.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-line text-small hover:border-cherry hover:text-cherry"
                      >
                        {f.name} <span className="text-ink-3 num">{f.records}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {r.terms.length > 0 && (
                <p className="text-small text-ink-3 mt-3">Frequent subject terms: {r.terms.join(" · ")}</p>
              )}
            </Section>
          )}

          <Section title="Listed with" subtitle="People named on the same records">
            {r.collaborators.length === 0 ? (
              <p className="text-small text-ink-3">No one else from Temple is named on these records.</p>
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
                      {c.crossCollege && <span className="font-semibold text-ink-2">Different college</span>}
                      {c.department && <span>{c.department}</span>}
                      {c.identityConfidence !== "high" && <ConfidenceChip confidence={c.identityConfidence} />}
                    </div>
                    <p className="text-tiny text-ink-3 mt-1">
                      Shared:{" "}
                      {c.projectIds.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <Link href={`/projects/${id}`} className="underline underline-offset-2 hover:text-cherry">
                            {id}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="About this profile">
            <div className="space-y-4 text-small text-ink-2">
              <p>{r.about}</p>
              <div>
                <h3 className="font-semibold text-ink mb-2">Sources</h3>
                <ul className="space-y-1">
                  {r.sources.map((s) => (
                    <li key={s.label} className="flex flex-wrap justify-between gap-x-3">
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
                        {s.label}
                      </a>
                      <span className="text-ink-3 num">
                        {count(s.records, "record")}
                        {s.lastSeen ? ` · updated ${shortDate(s.lastSeen)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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
