import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AwardRow from "@/components/AwardRow";
import Icon from "@/components/Icon";
import Section from "@/components/Section";
import { SourceTag } from "@/components/Tags";
import { DeadlineBadge, OpportunityStatusChip } from "@/components/opportunities/OpportunityBadges";
import OpportunityResearchersSection, { OpportunityResearchersSkeleton } from "@/components/opportunities/OpportunityResearchersSection";
import { getOpportunity } from "@/lib/api";
import { count, shortDate } from "@/lib/format";
import { deadlineLabel, dollars, HIGHER_ED_CODES } from "@/lib/opportunities";
import type { OpportunityDetail } from "@/lib/types";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const o = await getOpportunity(params.id);
  return { title: o?.title ?? "Funding opportunity" };
}

/** Paragraphs shown before "Read the full synopsis". */
const LEAD_PARAGRAPHS = 2;

function KeyFacts({ o }: { o: OpportunityDetail }) {
  const deadline = deadlineLabel(o);
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Award ceiling", value: dollars(o.awardCeiling) },
    { label: "Award floor", value: dollars(o.awardFloor) },
    { label: "Expected awards", value: o.expectedAwards != null && o.expectedAwards > 0 ? o.expectedAwards.toLocaleString() : "Not stated" },
    { label: "Total program funding", value: dollars(o.totalFunding) },
    { label: "Cost sharing or matching", value: o.costSharing ? "Required" : "Not required" },
    { label: "Funding instrument", value: o.fundingInstruments.length ? o.fundingInstruments.join(", ") : "Not stated" },
    { label: "Posted", value: shortDate(o.postedDate) || "Not stated" },
    {
      label: o.closeDateEstimated ? "Estimated deadline" : "Application deadline",
      value: deadline.date || "No fixed deadline",
    },
    { label: "Archive date", value: shortDate(o.archiveDate) || "Not stated" },
    {
      label: o.programs.length > 1 ? "Assistance listings (ALN)" : "Assistance listing (ALN)",
      value: o.programs.length ? o.programs.join(", ") : "None listed",
    },
  ];
  return (
    <dl className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line border border-line rounded-xl overflow-hidden">
      {facts.map((f) => (
        <div key={f.label} className="bg-surface px-4 py-3 min-w-0">
          <dt className="text-tiny text-ink-3 mb-1">{f.label}</dt>
          <dd className="text-small font-medium num break-words">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ApplyCard({ o }: { o: OpportunityDetail }) {
  const d = deadlineLabel(o);
  return (
    <div className="bg-surface border border-line rounded-xl p-5 shadow-card space-y-3 min-w-0">
      <DeadlineBadge opportunity={o} size="lg" />
      {d.date && (d.tone === "urgent" || d.tone === "open") && (
        <p className="text-small text-ink-2">
          Application deadline <span className="font-semibold text-ink num">{d.date}</span>
        </p>
      )}
      {d.tone === "estimated" && (
        <p className="text-small text-ink-2">The agency&apos;s estimate for a forecasted call. It isn&apos;t final until the call is posted.</p>
      )}
      {o.closeDateNote && (
        <p className="text-small text-ink-2 break-words">
          <span className="text-ink-3">Agency&apos;s note on the deadline: </span>
          {o.closeDateNote}
        </p>
      )}
      <a
        href={o.source.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-cherry text-white font-semibold hover:bg-cherry-dark text-center"
      >
        View and apply on Grants.gov ↗
      </a>
      <p className="text-tiny text-ink-3">
        Last checked on Grants.gov: <span className="num">{shortDate(o.updatedAt) || "unknown"}</span>. Confirm dates and
        requirements there before you apply.
      </p>
    </div>
  );
}

function Eligibility({ o }: { o: OpportunityDetail }) {
  return (
    <Section title="Eligibility" subtitle="Who the agency says can apply, in its own words.">
      {o.applicantTypes.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-4" aria-label="Eligible applicant types">
          {o.applicantTypes.map((t) => {
            const higherEd = HIGHER_ED_CODES.includes(t.code);
            return (
              <li
                key={t.code}
                className={`inline-flex items-center gap-1 text-small px-3 py-1 rounded-full border ${
                  higherEd ? "bg-active-bg border-active-ink/20 text-active-ink font-medium" : "bg-surface border-line text-ink-2"
                }`}
              >
                {higherEd && <Icon name="check" size={16} />}
                {t.label}
              </li>
            );
          })}
        </ul>
      )}
      {o.eligibilityText ? (
        <blockquote className="bg-surface border border-line border-l-4 border-l-line-strong rounded-lg px-4 py-3 text-body text-ink-2 whitespace-pre-line break-words max-w-[70ch]">
          {o.eligibilityText}
        </blockquote>
      ) : (
        <p className="text-small text-ink-3">The call gives no further eligibility wording. Read the full announcement on Grants.gov.</p>
      )}
      <p className="flex items-start gap-2 text-small text-ink-2 mt-4 max-w-[70ch]">
        <Icon name="info" size={18} className="text-ink-3 mt-0.5" />
        <span>
          ResearchConnect doesn&apos;t decide eligibility. This is the agency&apos;s text as published; confirm on Grants.gov
          and with your research administration office before you apply.
        </span>
      </p>
    </Section>
  );
}

function Description({ paragraphs }: { paragraphs: string[] }) {
  const lead = paragraphs.slice(0, LEAD_PARAGRAPHS);
  const rest = paragraphs.slice(LEAD_PARAGRAPHS);
  return (
    <Section title="About this call" subtitle="The agency's synopsis, as published on Grants.gov.">
      {paragraphs.length ? (
        <div className="space-y-4 text-body text-ink-2 max-w-[70ch] break-words">
          {lead.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {rest.length > 0 && (
            <details>
              <summary className="cursor-pointer text-small font-medium text-cherry">Read the full synopsis</summary>
              <div className="space-y-4 mt-3">
                {rest.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="text-small text-ink-3">Grants.gov has no synopsis for this call. The full announcement is on its Grants.gov page.</p>
      )}
    </Section>
  );
}

function PastAwards({ o }: { o: OpportunityDetail }) {
  const programs = o.programs.join(", ");
  if (!o.programs.length) {
    return (
      <Section title="Temple's past awards under this program">
        <p className="text-small text-ink-3">This call lists no assistance listing number, so past Temple awards can&apos;t be matched to it.</p>
      </Section>
    );
  }
  return (
    <Section
      title="Temple's past awards under this program"
      subtitle={
        o.pastAwardCount
          ? `${count(o.pastAwardCount, "Temple award")} under ${programs}${
              o.pastAwardCount > o.pastAwards.length ? `, the ${o.pastAwards.length} most recent shown` : ""
            }. Funding history, not proof a study is active.`
          : undefined
      }
    >
      {o.pastAwards.length ? (
        <ul className="bg-surface border border-line rounded-xl px-5">
          {o.pastAwards.map((p) => (
            <AwardRow key={p.id} project={p} />
          ))}
        </ul>
      ) : (
        <p className="text-small text-ink-3">No Temple awards in our records under {programs}.</p>
      )}
    </Section>
  );
}

function Contact({ o }: { o: OpportunityDetail }) {
  const { name, email, phone } = o.contact;
  return (
    <Section title="Agency contact">
      {name || email || phone ? (
        <div className="bg-surface border border-line rounded-xl px-4 py-3 space-y-1.5 text-small min-w-0">
          {name && <p className="font-medium text-ink break-words">{name}</p>}
          {email && (
            <p className="flex items-start gap-2 min-w-0">
              <Icon name="mail" size={18} className="text-ink-3 mt-0.5" />
              <a href={`mailto:${email}`} className="text-cherry underline underline-offset-2 break-all">
                {email}
              </a>
            </p>
          )}
          {phone && (
            <p className="text-ink-2 break-words">
              <span className="text-ink-3">Phone </span>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="num hover:text-cherry">
                {phone}
              </a>
            </p>
          )}
        </div>
      ) : (
        <p className="text-small text-ink-3">The call lists no contact. Grants.gov&apos;s page has the agency&apos;s details.</p>
      )}
    </Section>
  );
}

export default async function OpportunityPage({ params }: { params: { id: string } }) {
  const o = await getOpportunity(params.id);
  if (!o) notFound();

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-10">
      <nav aria-label="Breadcrumb" className="text-small text-ink-3 min-w-0 break-words">
        <Link href="/opportunities" className="hover:text-ink">
          Funding opportunities
        </Link>{" "}
        <span aria-hidden="true">/</span> <span className="text-ink-2 num">{o.number}</span>
      </nav>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <header className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <OpportunityStatusChip status={o.status} />
            <SourceTag agency={o.agency} />
            <span className="text-small text-ink-3 num break-all">{o.number}</span>
          </div>
          <h1 className="text-[30px] leading-[38px] sm:text-h1 break-words">{o.title}</h1>
          <p className="text-small text-ink-3 mt-3 break-words">
            Offered by <span className="text-ink font-medium">{o.agencyName}</span>
            {o.categories.length > 0 && <> · {o.categories.join(", ")}</>}
          </p>
        </header>
        <ApplyCard o={o} />
      </div>

      <KeyFacts o={o} />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-12">
        <div className="space-y-10 min-w-0">
          <Eligibility o={o} />
          <Description paragraphs={o.description} />
          <PastAwards o={o} />
          <Suspense fallback={<OpportunityResearchersSkeleton />}>
            <OpportunityResearchersSection id={o.id} />
          </Suspense>
        </div>

        <aside className="space-y-10 min-w-0">
          <Contact o={o} />
          <p className="text-small text-ink-3">
            A call is an invitation to apply, not an award. This page copies the agency&apos;s record from{" "}
            <a href={o.source.url} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
              {o.source.label}
            </a>
            , last checked {shortDate(o.updatedAt) || "at an unknown time"}. Dates and eligibility can change; the Grants.gov
            page is the official record.
          </p>
        </aside>
      </div>
    </main>
  );
}
