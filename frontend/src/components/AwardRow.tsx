import Link from "next/link";
import { money } from "@/lib/format";
import type { Project } from "@/lib/types";
import { CollegeTag, SourceTag, StatusChip } from "./Tags";

/** One award as a compact two-line row. Used by search, topic and explore lists. */
export default function AwardRow({ project, showSummary = false }: { project: Project; showSummary?: boolean }) {
  return (
    <li className="py-4 border-b border-line last:border-b-0">
      <div className="flex flex-col sm:flex-row sm:items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            {project.colleges.map((c) => (
              <CollegeTag key={c} id={c} />
            ))}
          </div>
          <h3 className="font-sans text-body font-semibold leading-snug">
            <Link href={`/projects/${project.id}`} className="hover:text-cherry hover:underline underline-offset-2">
              {project.title}
            </Link>
          </h3>
          <p className="text-small text-ink-3 mt-1">
            {project.pi.name}
            {project.pi.department && project.pi.department !== "Temple University" ? ` · ${project.pi.department}` : ""}
          </p>
          {showSummary && <p className="text-small text-ink-2 mt-2 line-clamp-2">{project.summary}</p>}
          {project.match && <p className="text-tiny text-ink-3 mt-1.5">{project.match.reason}</p>}
        </div>
        <div className="flex sm:flex-col sm:items-end items-center gap-2 shrink-0 text-small">
          <div className="flex items-center gap-1.5">
            <SourceTag agency={project.agency} />
            <StatusChip active={project.active} />
          </div>
          <span className="num text-ink-2">
            {project.startYear}–{project.endYear}
            <span className="text-ink-3"> · </span>
            {money(project.amount)}
          </span>
        </div>
      </div>
    </li>
  );
}
