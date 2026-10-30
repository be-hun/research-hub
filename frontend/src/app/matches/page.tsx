import Link from "next/link";
import Icon from "@/components/Icon";
import { getCollaboratorMatches, hasResearcherProfile } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";

export default async function MatchesPage() {
  // TODO: use the signed-in researcher once auth exists.
  const matches = await getCollaboratorMatches("r-rivera");

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-8">
      <div className="mb-space-lg">
        <h1 className="font-headline text-headline-lg">Suggested Collaborators</h1>
        <p className="text-body-md text-tertiary">Cross-college faculty who share methods, grant targets, or domain questions with you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-8 space-y-4">
          {matches.map((m) => (
            <article key={m.researcherId} className="relative overflow-hidden bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: COLLEGES[m.college].color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary font-headline text-headline-sm flex items-center justify-center shrink-0">
                    {m.initials}
                  </div>
                  <div>
                    <h2 className="font-headline text-headline-sm">
                      {hasResearcherProfile(m.researcherId) ? (
                        <Link href={`/researchers/${m.researcherId}`} className="hover:text-primary">{m.name}</Link>
                      ) : (
                        m.name
                      )}
                    </h2>
                    <p className="text-body-sm text-tertiary">
                      {COLLEGES[m.college].name} • {m.title}
                    </p>
                  </div>
                </div>
                <span className="bg-emerald-50 text-emerald-800 text-label-md font-bold px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                  {m.score}% Match
                </span>
              </div>

              <div className="mt-4 bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg p-3 text-[#2F4FD1] text-body-sm">
                <div className="flex items-center gap-1.5 font-semibold mb-1.5">
                  <Icon name="psychology" size={18} /> Why this match
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[#1E1B4B]">
                  {m.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.citations.map((c) => (
                    <span key={c} className="text-[11px] font-medium px-2 py-0.5 bg-white border border-[#C7D2FE] rounded">{c}</span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-tertiary">Shared:</span>
                  {m.sharedTopics.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-surface-container text-on-surface">{t}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-surface-container-highest text-label-md hover:bg-surface-container-low">Save</button>
                  <button className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary text-label-md hover:bg-primary">Request introduction</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5">
            <h2 className="font-headline text-headline-sm flex items-center gap-2 mb-2">
              <Icon name="info" size={20} className="text-secondary" /> How matching works
            </h2>
            <p className="text-body-sm text-tertiary">
              ResearchConnect compares faculty records across colleges to connect researchers who share methods, grant
              targets, or domain questions but might never meet.
            </p>
          </section>
          <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5">
            <h2 className="font-headline text-headline-sm flex items-center gap-2 mb-2">
              <Icon name="verified_user" size={20} className="text-emerald-700" /> Verified records only
            </h2>
            <p className="text-body-sm text-tertiary mb-2">
              Matching uses public academic records and faculty-confirmed details. No private emails, drafts, or
              unapproved CV text are used.
            </p>
            <ul className="text-body-sm text-on-surface-variant space-y-1">
              <li>Federal &amp; foundation awards</li>
              <li>Peer-reviewed publications</li>
              <li>Faculty-claimed research topics</li>
              <li>Temple academic registry</li>
            </ul>
          </section>
          <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-5">
            <h2 className="font-headline text-headline-sm flex items-center gap-2 mb-2">
              <Icon name="handshake" size={20} className="text-primary" /> How introductions work
            </h2>
            <p className="text-body-sm text-tertiary">
              &ldquo;Request introduction&rdquo; drafts an email citing shared grant targets and publications. You review
              and edit before sending.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
