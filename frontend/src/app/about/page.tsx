import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Section from "@/components/Section";
import { getOverview } from "@/lib/api";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "About the data" };

const AUDIENCES = [
  {
    title: "Students",
    text: "Find who works on a topic you care about, in any college, and read what they are funded to do.",
  },
  {
    title: "Faculty",
    text: "See who outside your own college works near your area: possible collaborators you would not otherwise meet.",
  },
  {
    title: "Staff and leadership",
    text: "Get an honest overview of Temple's federally funded research by college, topic and year.",
  },
];

const STEPS = [
  ["Public award records", "NIH RePORTER and NSF Award Search publish every federal award to Temple."],
  ["Import and clean", "A script pulls Temple's awards, removes duplicates, maps each to a college and topic, and keeps a link to the original."],
  ["Searchable database", "Search, filters, counts and charts are ordinary database queries. No AI is involved in any number you see."],
  ["Ask", "For a question, the assistant first searches the records, then writes an answer only from those records, citing each one."],
];

const LIMITS = [
  "An award record is funding history. It does not show that a study is active, recruiting, or taking students.",
  "Only federal awards from NIH and NSF are included, so most of a researcher's work, and whole fields that are not federally funded, are missing.",
  "NIH names an award's department; NSF names only the directorate that funded it, so colleges for NSF awards are inferred and can be wrong.",
  "People are matched across NIH and NSF by first and last name.",
  "Topics group awards by the institute or division that funded them, not by reading the research itself.",
  "The most recent fiscal year may be incomplete while the funders are still publishing records.",
];

const AI_DOES = [
  "Answers only from award records it retrieved for your question, and numbers a source for every claim.",
  "Says plainly when no record matches, instead of guessing.",
  "Drops any citation that does not point to a record it was given.",
];
const AI_DOES_NOT = [
  "Invent projects, people, amounts or findings.",
  "Store or use emails, student records or any private data. Everything here is public.",
  "Decide what you see in search, filters, counts or charts.",
];

export default async function AboutPage() {
  const o = await getOverview();

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10 space-y-16">
      <header className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
        <div>
          <h1 className="text-h1">About ResearchConnect</h1>
          <p className="text-lead text-ink-2 mt-3">
            Research at Temple is spread across many schools and colleges. Unless you already know who to ask, it is
            hard to see what is happening outside your own department. ResearchConnect puts Temple&apos;s public research
            funding in one place, so anyone can see who works on what, and check it against the original record.
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
        <div className="grid sm:grid-cols-2 gap-4">
          {o.sources.map((s) => (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="block bg-surface border border-line rounded-xl p-5 hover:border-line-strong">
              <div className="font-semibold">{s.label} ↗</div>
              <div className="font-serif text-h2 num mt-1">{s.awards.toLocaleString()} awards</div>
              <div className="text-small text-ink-3">{s.coverage}</div>
            </a>
          ))}
        </div>
        <p className="text-small text-ink-3 mt-3">
          {o.updatedAt ? `Last imported ${shortDate(o.updatedAt)}. ` : ""}Planned, not yet included: U.S. Department of
          Education awards, publications (ORCID, TUScholarShare) and faculty-confirmed profiles.
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
          Human oversight: every answer, search result and chart links back to the original federal record, so a person
          can check it. The AI model is called only from the server, behind one module that can be swapped for another
          provider.
        </p>
      </Section>

      <Section title="Questions or corrections">
        <p className="text-body text-ink-2 max-w-3xl">
          ResearchConnect is a student prototype for the Temple AI Build Challenge, not an official Temple University
          record. If something looks wrong, the source link on each award is the authority.{" "}
          <Link href="/explore" className="text-cherry underline underline-offset-2">
            Explore the data
          </Link>
        </p>
      </Section>
    </main>
  );
}
