import Image from "next/image";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import BarList from "@/components/charts/BarList";
import SearchBar from "@/components/SearchBar";
import Section from "@/components/Section";
import StatTiles from "@/components/StatTiles";
import TopicTile from "@/components/TopicTile";
import { getOverview } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { money, shortDate } from "@/lib/format";

const EXAMPLES = ["machine learning", "battery energy storage", "opioid addiction", "Alzheimer's disease"];

export default async function HomePage() {
  const o = await getOverview();

  return (
    <main>
      {/* Hero */}
      <section className="max-w-page mx-auto px-4 sm:px-6 pt-12 pb-14 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
        <div>
          <p className="text-small font-semibold text-cherry mb-3">Temple University research, in one place</p>
          <h1 className="text-[40px] leading-[46px] sm:text-display font-serif text-ink">
            See the research happening across Temple
          </h1>
          <p className="text-lead text-ink-2 mt-4 mb-7 max-w-xl">
            {o.totals.awards.toLocaleString()} federally funded awards across {o.totals.colleges} colleges, searchable in
            plain English and traceable to the original record.
          </p>
          <SearchBar size="lg" placeholder="Try: machine learning in healthcare" />
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-small text-ink-3">Try</span>
            {EXAMPLES.map((q) => (
              <Link
                key={q}
                href={`/search?q=${encodeURIComponent(q)}`}
                className="text-small px-3 py-1 rounded-full bg-surface border border-line hover:border-cherry hover:text-cherry"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
          <Image
            src="/images/hero-lab.jpg"
            alt="Students working together at a lab bench with a microscope and a laptop"
            fill
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <div className="max-w-page mx-auto px-4 sm:px-6 space-y-16">
        <div>
          <StatTiles totals={o.totals} />
          <p className="text-tiny text-ink-3 mt-2">
            Source: {o.sources.map((s) => s.label).join(" and ")}
            {o.updatedAt ? ` · updated ${shortDate(o.updatedAt)}` : ""}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12">
          <Section
            title="Where the funding goes"
            subtitle="Money obligated since FY2022, by college"
            action={{ href: "/explore", label: "Explore all data" }}
          >
            <BarList
              caption="Funding by college since fiscal year 2022"
              rows={o.byCollege.map((c) => ({
                key: c.college,
                label: COLLEGES[c.college].short,
                href: `/search?college=${c.college}`,
                color: COLLEGES[c.college].color,
                value: c.funding,
                valueLabel: money(c.funding),
                detail: `${c.awards} awards · ${c.active} active`,
              }))}
            />
          </Section>

          <Section title="Browse by topic" action={{ href: "/topics", label: "All topics" }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {o.topics.slice(0, 6).map((t) => (
                <TopicTile key={t.id} topic={t} />
              ))}
            </div>
          </Section>
        </div>

        <Section title="Recently started" subtitle="The newest active awards" action={{ href: "/search?status=active", label: "All active awards" }}>
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.recent.slice(0, 5).map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}
