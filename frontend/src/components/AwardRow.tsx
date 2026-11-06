import Link from "next/link";
import { isStaleTrialStatus, money, shortDate, yearRange } from "@/lib/format";
import type { MatchBand, Project } from "@/lib/types";
import Icon from "./Icon";
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
      <span className="num text-ink-2">{yearRange(project.startYear, project.endYear)}</span>
    );
  }
  return (
    <span className="num text-ink-2">
      {yearRange(project.startYear, project.endYear)}
      <span className="text-ink-3"> · </span>
      {money(project.amount)}
    </span>
  );
}

/** The bands worth pointing out. "Some overlap" is a weak match and gets no badge. */
const SHOWN_BANDS: MatchBand[] = ["Strong overlap", "Good overlap"];

/** Search's abstract snippet, with each matched word (sent as ⟦word⟧) highlighted. Built as text, never as HTML. */
function Snippet({ text }: { text: string }) {
  return (
    <p className="text-small text-ink-2 mt-2 break-words">
      {text.split(/(⟦[^⟧]*⟧)/).map((part, i) =>
        part.startsWith("⟦") && part.endsWith("⟧") ? (
          <mark key={i} className="bg-soon-bg text-ink font-medium rounded-sm px-0.5">
            {part.slice(1, -1)}
          </mark>
        ) : (
          part
        ),
      )}
    </p>
  );
}

/** One record (grant, trial or publication) as a compact row. Used by search, topic and explore lists. */
export default function AwardRow({
  project,
  showSummary = false,
  context,
  interestMatch,
  interestBand,
  snippet = project.match?.snippet,
  stacked = false,
}: {
  project: Project;
  showSummary?: boolean;
  /** Extra line under the people line, e.g. the profile owner's role on this record. */
  context?: string;
  /** Demo account only: why this record matches the signed-in profile's interests. */
  interestMatch?: string;
  /** Demo account only: how strong that match is. With a band, only Strong and Good overlap get the badge. */
  interestBand?: MatchBand;
  /** Words around the match, with matched words in ⟦ ⟧. Defaults to the search result's own snippet. */
  snippet?: string | null;
  /** Keep status and dates under the title even on wide screens, for narrow columns. */
  stacked?: boolean;
}) {
  // Some sources (USDA, a few NSF awards) name no investigator; say so instead of leaving a gap.
  const people =
    project.kind === "trial"
      ? project.funder.trim()
        ? `Sponsor: ${project.funder}`
        : "Sponsor not listed"
      : [project.pi.name.trim() || "Principal investigator not listed", project.pi.department].filter(Boolean).join(" · ");
  const stale = project.kind === "trial" && isStaleTrialStatus(project.statusLabel, project.endYear);
  const showInterest = interestBand ? SHOWN_BANDS.includes(interestBand) : !!interestMatch;
  return (
    <li className="py-4 border-b border-line last:border-b-0">
      <div className={`flex flex-col gap-x-6 gap-y-2 ${stacked ? "" : "sm:flex-row sm:items-start"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <KindTag kind={project.kind} />
            {project.colleges.map((c) => (
              <CollegeTag key={c} id={c} />
            ))}
          </div>
          <h3 className="font-sans text-body font-semibold leading-snug line-clamp-3" title={project.title}>
            <Link href={`/projects/${project.id}`} className="hover:text-cherry hover:underline underline-offset-2">
              {project.title}
            </Link>
          </h3>
          <p className="text-small text-ink-3 mt-1 break-words">{people}</p>
          {context && <p className="text-tiny text-ink-2 mt-1">{context}</p>}
          {showInterest && (
            <p className="inline-flex items-start gap-1 text-tiny font-medium text-cherry bg-cherry-tint rounded-md px-2 py-1 mt-2">
              <Icon name="star" size={14} className="mt-[3px]" />
              <span>
                Matches your interests{interestBand && <> · <strong className="font-semibold">{interestBand}</strong></>}
                {interestMatch && <span className="font-normal text-cherry-dark"> · {interestMatch}</span>}
              </span>
            </p>
          )}
          {snippet ? (
            <Snippet text={snippet} />
          ) : (
            showSummary && <p className="text-small text-ink-2 mt-2 line-clamp-2">{project.summary}</p>
          )}
          {project.kind !== "award" && project.fundingTypes.length > 0 && (
            <p className="text-tiny text-ink-3 mt-1.5">Funding: {project.fundingTypes.join(" · ")}</p>
          )}
          {project.match && <p className="text-tiny text-ink-3 mt-1">{project.match.reason}</p>}
        </div>
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0 text-small ${
            stacked ? "" : "sm:flex-col sm:flex-nowrap sm:items-end sm:max-w-[16rem]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {project.kind === "award" && <SourceTag agency={project.agency} />}
            <StatusChip label={project.statusLabel} active={project.active} stale={stale} />
          </div>
          <Meta project={project} />
          {project.kind === "trial" && project.updatedAt && (
            <span className="text-tiny text-ink-3">Registry record updated {shortDate(project.updatedAt)}</span>
          )}
        </div>
      </div>
    </li>
  );
}
