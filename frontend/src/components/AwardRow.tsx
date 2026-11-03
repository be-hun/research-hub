import Link from "next/link";
import { money } from "@/lib/format";
import type { Project } from "@/lib/types";
import { CollegeTag, KindTag, SourceTag, StatusChip } from "./Tags";

function Meta({ project }: { project: Project }) {
  if (project.kind === "publication") {
    return (
      <span className="text-ink-2 text-right">
        <span className="italic">{project.agency}</span>
      </span>
    );
  }
  if (project.kind === "trial") {
    return (
      <span className="num text-ink-2">
        {project.startYear}–{project.endYear}
      </span>
    );
  }
  return (
    <span className="num text-ink-2">
      {project.startYear}–{project.endYear}
      <span className="text-ink-3"> · </span>
      {money(project.amount)}
    </span>
  );
}

/** One record (grant, trial or publication) as a compact row. Used by search, topic and explore lists. */
export default function AwardRow({
  project,
  showSummary = false,
  context,
}: {
  project: Project;
  showSummary?: boolean;
  /** Extra line under the people line, e.g. the profile owner's role on this record. */
  context?: string;
}) {
  const people =
    project.kind === "trial" ? `Sponsor: ${project.funder}` : project.pi.name + (project.pi.department ? ` · ${project.pi.department}` : "");
  return (
    <li className="py-4 border-b border-line last:border-b-0">
      <div className="flex flex-col sm:flex-row sm:items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <KindTag kind={project.kind} />
            {project.colleges.map((c) => (
              <CollegeTag key={c} id={c} />
            ))}
          </div>
          <h3 className="font-sans text-body font-semibold leading-snug">
            <Link href={`/projects/${project.id}`} className="hover:text-cherry hover:underline underline-offset-2">
              {project.title}
            </Link>
          </h3>
          {people.trim() && <p className="text-small text-ink-3 mt-1 truncate">{people}</p>}
          {context && <p className="text-tiny text-ink-2 mt-1">{context}</p>}
          {showSummary && <p className="text-small text-ink-2 mt-2 line-clamp-2">{project.summary}</p>}
          {project.kind !== "award" && project.fundingTypes.length > 0 && (
            <p className="text-tiny text-ink-3 mt-1.5">Funding: {project.fundingTypes.join(" · ")}</p>
          )}
          {project.match && <p className="text-tiny text-ink-3 mt-1">{project.match.reason}</p>}
        </div>
        <div className="flex sm:flex-col sm:items-end items-center gap-2 shrink-0 text-small sm:max-w-[16rem]">
          <div className="flex items-center gap-1.5">
            {project.kind === "award" && <SourceTag agency={project.agency} />}
            <StatusChip label={project.statusLabel} active={project.active} />
          </div>
          <Meta project={project} />
        </div>
      </div>
    </li>
  );
}
