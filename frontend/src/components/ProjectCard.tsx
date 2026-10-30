import Link from "next/link";
import { COLLEGES } from "@/lib/colleges";
import type { Project } from "@/lib/types";
import Icon from "./Icon";

const VERIFICATION = {
  "faculty-confirmed": { label: "Faculty confirmed ✓", cls: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" },
  "public-award-record": { label: "Public award record", cls: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
} as const;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });

export default function ProjectCard({ project }: { project: Project }) {
  const v = VERIFICATION[project.verification];
  const lead = COLLEGES[project.colleges[0]];

  return (
    <article className="relative overflow-hidden bg-surface-container-lowest border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-md rounded-xl p-5 transition-all">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: lead.color }} />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {project.colleges.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-low border border-[#E2E8F0]"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: COLLEGES[id].color }} />
              {COLLEGES[id].name}
            </span>
          ))}
          {project.colleges.length > 1 && (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F1F5F9] text-tertiary border border-[#E2E8F0]">
              Cross-college
            </span>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${v.cls}`}>{v.label}</span>
      </div>

      <h3 className="font-headline text-headline-sm font-bold leading-snug">
        <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors">
          {project.title}
        </Link>
      </h3>
      <p className="text-body-md text-tertiary mt-2">{project.summary}</p>

      {project.match && (
        <div className="my-3.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg p-3 text-[#2F4FD1] flex items-start gap-2 text-body-sm">
          <Icon name="auto_awesome" size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p>
              <strong className="font-semibold">Why this matched:</strong> {project.match.reason}
            </p>
            <div className="flex flex-wrap gap-2">
              {project.match.evidence.map((e) => (
                <span key={e} className="text-[11px] font-medium px-2 py-0.5 bg-white border border-[#C7D2FE] rounded">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-y-2 text-body-sm text-tertiary pt-3 mt-3 border-t border-[#F1F5F9]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-medium text-on-surface">
            <strong className="font-semibold text-tertiary">PI:</strong> {project.pi.name}, {project.pi.department}
          </span>
          <span>•</span>
          <span>
            {project.funder} • {project.startYear}–{project.endYear}
          </span>
          <span>•</span>
          <a href={project.source.url} className="text-secondary hover:underline inline-flex items-center gap-0.5 font-medium">
            Source: {project.source.label} <Icon name="open_in_new" size={14} />
          </a>
        </div>
        <span className="text-xs">Updated {formatDate(project.updatedAt)}</span>
      </div>
    </article>
  );
}
