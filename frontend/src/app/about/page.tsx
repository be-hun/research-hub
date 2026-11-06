import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Section from "@/components/Section";
import { PHOTOS } from "@/lib/photos";
import SourceCards from "@/components/SourceCards";
import { getOverview } from "@/lib/api";
import { AUDIENCES } from "@/lib/audiences";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "About ResearchConnect" };

const STEPS = [
  ["Public records", "Grants (NIH, NSF, USAspending), trials (ClinicalTrials.gov) and papers (OpenAlex)."],
  ["Import and clean", "Deduplicated, mapped to colleges, topics and funding types, linked to the original."],
  ["Database", "Search, filters, counts and charts are plain queries. No AI in any number."],
  ["Ask", "The assistant searches the records first and answers only from them."],
];

const LIMITS = [
  "Grant records show funding, not whether a study is active or taking students.",
  "Trial statuses come from ClinicalTrials.gov and can be out of date.",
  "Industry and foundation money only shows up when a trial or paper names it.",
  "Papers: 2024 onward, funded articles only.",
  "Funding types are matched from funder names and can be wrong.",
  "USAspending includes some training and service grants.",
  "Colleges for NSF grants and trial sites are approximate.",
  "People are matched by name, so two people with the same name can merge.",
  "Trial and paper topics are matched by title keywords.",
  "The latest fiscal year may be incomplete.",
];

const AI_DOES = [
  "Answers only from the records it retrieved, and cites them.",
  "Says when nothing matches.",
  "Drops people and records it wasn't given.",
];
const AI_DOES_NOT = [
  "Invent projects, people, amounts or findings.",
  "Use private data. Everything here is public.",
  "Affect search, filters, counts or charts.",
];

export default async function AboutPage() {
  const o = await getOverview();

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10 space-y-16">
      <header className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
        <div>
          <h1 className="text-[32px] leading-[40px] font-semibold tracking-[-0.015em] sm:text-h1">About ResearchConnect</h1>
          <p className="text-lead text-ink-2 mt-3">
            Temple&apos;s research is spread across many colleges and hard to see from outside your department.
            ResearchConnect puts it in one place: who works on what, linked to the original records.
          </p>
        </div>
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
          <Image
            src="/images/about-collaboration.jpg"
            alt="Researchers from different fields discussing work around a table"
            fill
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover"
          />
        </div>
      </header>

      <Section title="Who it is for">
        <div className="grid md:grid-cols-3 gap-4">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="bg-surface border border-line rounded-xl p-5">
              <h3 className="text-h3">{a.title}</h3>
              <p className="text-small text-ink-2 mt-2">{a.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="sources" title="Where the data comes from">
        <SourceCards sources={o.sources} />
        <p className="text-small text-ink-3 mt-3">
          {o.updatedAt ? `Last imported ${shortDate(o.updatedAt)}. ` : ""}Not yet included: faculty-confirmed profiles,
          older papers, TUScholarShare.
        </p>
      </Section>

      <Section id="how-it-works" title="How it works">
        <ol className="grid md:grid-cols-4 gap-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="relative bg-surface border border-line rounded-xl p-5">
              <span className="font-serif text-h2 text-cherry num">{i + 1}</span>
              <h3 className="text-h3 mt-1">{title}</h3>
              <p className="text-small text-ink-2 mt-2">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="limits" title="What this data can and can't tell you">
        <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
          {LIMITS.map((l) => (
            <li key={l} className="px-5 py-3.5 text-body text-ink-2">
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="responsible-ai" title="Responsible AI">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-surface border border-line rounded-xl p-5">
            <h3 className="text-h3">The assistant does</h3>
            <ul className="mt-3 space-y-2 text-small text-ink-2 list-disc pl-5">
              {AI_DOES.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="bg-surface border border-line rounded-xl p-5">
            <h3 className="text-h3">The assistant does not</h3>
            <ul className="mt-3 space-y-2 text-small text-ink-2 list-disc pl-5">
              {AI_DOES_NOT.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-small text-ink-3 mt-4 max-w-3xl">
          Every answer, result and chart links to its original record. The AI model runs only on the server.
        </p>
      </Section>

      <Section id="photo-credits" title="Photo credits" subtitle="Campus photos are openly licensed from Wikimedia Commons">
        <ul className="text-small text-ink-2 space-y-1.5 max-w-3xl">
          {Object.values(PHOTOS).map((p) => (
            <li key={p.src}>
              <span className="text-ink">{p.caption}</span>: photo by{" "}
              <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
                {p.author}
              </a>
              ,{" "}
              <a href={p.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {p.license}
              </a>
              . Resized for the web.
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Questions or corrections">
        <p className="text-body text-ink-2 max-w-3xl">
          A student prototype for the Temple AI Build Challenge, not an official Temple record. If something looks
          wrong, the source link on each record wins.{" "}
          <Link href="/explore" className="text-cherry underline underline-offset-2">
            Explore the data
          </Link>
        </p>
      </Section>
    </main>
  );
}
