import Link from "next/link";
import ConfidenceNotice from "@/components/ConfidenceNotice";
import { CollegeTag } from "@/components/Tags";
import type { ResearcherProfile } from "@/lib/types";

/** Identity, the one provenance note, and headline counts. Each count opens the records of that type. */
export default function ResearcherHeader({ profile }: { profile: ResearcherProfile }) {
  const stats = [
    { kind: "award", value: profile.counts.grants, label: profile.counts.grants === 1 ? "grant" : "grants" },
    { kind: "trial", value: profile.counts.trials, label: profile.counts.trials === 1 ? "clinical trial" : "clinical trials" },
    { kind: "publication", value: profile.counts.publications, label: profile.counts.publications === 1 ? "publication" : "publications" },
  ];
  return (
    <header className="grid lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
      <div className="flex flex-col sm:flex-row gap-5 sm:items-start min-w-0">
        <div
          className="w-20 h-20 rounded-full bg-cherry-tint text-cherry font-serif text-h2 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {profile.initials}
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <h1 className="text-h1 break-words">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-small text-ink-2">
              {profile.college ? (
                <Link href={`/colleges/${profile.college}`} className="hover:underline underline-offset-2">
                  <CollegeTag id={profile.college} short={false} />
                </Link>
              ) : (
                <span>College not reported</span>
              )}
              {profile.department && <span>{profile.department}</span>}
            </div>
            <p className="text-tiny text-ink-3 mt-2">
              Public-record profile{profile.roles.length > 0 && <> · Listed as {profile.roles.join(", ")}</>}
              {profile.orcid && (
                <>
                  {" · "}
                  <a href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
                    ORCID {profile.orcid}
                  </a>
                </>
              )}
            </p>
          </div>
          <p className="text-lead text-ink-2">{profile.summary}</p>
          <ConfidenceNotice confidence={profile.identityConfidence} note={profile.identityNote} verified={profile.verified} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-px bg-line rounded-xl overflow-hidden border border-line">
        {stats.map((s) => (
          <div key={s.kind} className="bg-surface">
            <dt className="sr-only">{s.label}</dt>
            <dd>
              {s.value > 0 ? (
                <Link href={`?kind=${s.kind}#records`} className="block px-4 py-4 hover:bg-canvas group">
                  <span className="block font-serif text-h1 num text-ink group-hover:text-cherry">{s.value.toLocaleString()}</span>
                  <span className="block text-small text-ink-2">{s.label}</span>
                </Link>
              ) : (
                <span className="block px-4 py-4">
                  <span className="block font-serif text-h1 num text-ink-3">0</span>
                  <span className="block text-small text-ink-3">{s.label}</span>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
