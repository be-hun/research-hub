import { CollegeTag } from "@/components/Tags";
import type { ResearcherProfile } from "@/lib/types";

export default function ResearcherHeader({ profile }: { profile: ResearcherProfile }) {
  return (
    <header className="flex flex-col sm:flex-row gap-5 sm:items-start">
      <div
        className="w-16 h-16 rounded-full bg-cherry-tint text-cherry font-serif text-h3 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        {profile.initials}
      </div>
      <div className="min-w-0">
        <h1 className="text-h1 break-words">{profile.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-small text-ink-2">
          {profile.college ? <CollegeTag id={profile.college} short={false} /> : <span>College not reported</span>}
          {profile.department && <span>{profile.department}</span>}
        </div>
        <p className="text-tiny text-ink-3 mt-2">
          Public-record profile · {profile.verified ? "Confirmed by researcher" : "Not confirmed by researcher"}
          {profile.roles.length > 0 && <> · Listed as {profile.roles.join(", ")}</>}
        </p>
        {profile.orcid && (
          <a
            href={`https://orcid.org/${profile.orcid}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-tiny text-cherry underline underline-offset-2 mt-1"
          >
            ORCID {profile.orcid}
          </a>
        )}
        <p className="text-lead text-ink-2 mt-3">{profile.summary}</p>
      </div>
    </header>
  );
}
