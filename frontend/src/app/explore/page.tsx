import type { Metadata } from "next";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import BarList from "@/components/charts/BarList";
import YearBars from "@/components/charts/YearBars";
import Section from "@/components/Section";
import SourceCards from "@/components/SourceCards";
import StatTiles from "@/components/StatTiles";
import TopicTile from "@/components/TopicTile";
import { getOverview } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { count, money, shortDate } from "@/lib/format";
import { trendData } from "@/lib/series";

export const metadata: Metadata = { title: "Explore" };

// One neutral hue for counts that are not split by college or funder: the bars compare length, not identity.
const COUNT_COLOR = "#A41E35";

export default async function ExplorePage() {
  const o = await getOverview();
  const trend = trendData(o.trend);
  const firstFy = o.trend[0]?.fiscalYear;
  const lastFy = o.trend[o.trend.length - 1]?.fiscalYear;
  const nonFederal = o.fundingTypes.filter((t) => t.type !== "federal");

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10 space-y-14">
      <header className="max-w-3xl">
        <h1 className="text-h1">Temple research at a glance</h1>
        <p className="text-lead text-ink-2 mt-2">
          Grants, clinical trials and papers from {o.sources.length} public sources.
        </p>
      </header>

      <StatTiles totals={o.totals} />

      <div className="grid lg:grid-cols-2 gap-12">
        <Section id="colleges" title="Funding by college" subtitle={`Grant money obligated FY${firstFy}–FY${lastFy}`}>
          <BarList
            caption="Grant funding by college"
            rows={o.byCollege
              .filter((c) => c.funding > 0)
              .map((c) => ({
                key: c.college,
                label: COLLEGES[c.college].short, // the same names as Home's funding chart
                href: `/search?college=${c.college}`,
                color: COLLEGES[c.college].color,
                value: c.funding,
                valueLabel: money(c.funding),
                detail: [count(c.awards, "grant"), count(c.trials, "trial"), count(c.publications, "paper")].join(" · "),
              }))}
          />
          {o.byCollege.some((c) => c.funding === 0) && (
            <p className="text-small text-ink-3 mt-3">
              Trials and papers only:{" "}
              {o.byCollege
                .filter((c) => c.funding === 0)
                .map((c) => (
                  <Link key={c.college} href={`/search?college=${c.college}`} className="text-cherry hover:underline">
                    {COLLEGES[c.college].short} ({c.trials + c.publications})
                  </Link>
                ))
                .reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}
              .
            </p>
          )}
        </Section>

        <Section title="Federal funding by agency" subtitle={`Grant money obligated FY${firstFy}–FY${lastFy}`}>
          <BarList
            caption="Federal grant funding by agency"
            rows={o.federalByAgency.slice(0, 8).map((a) => ({
              key: a.agency,
              label: a.agency,
              href: `/search?kind=award&funder=${encodeURIComponent(a.agency)}`,
              color: COUNT_COLOR,
              value: a.funding,
              valueLabel: money(a.funding),
              detail: count(a.awards, "grant"),
            }))}
          />
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        <Section
          id="funding-types"
          title="Funding beyond the federal government"
          subtitle="Trials and papers by funder type"
        >
          <BarList
            caption="Records by funding type"
            rows={nonFederal.map((t) => ({
              key: t.type,
              label: t.label,
              href: `/search?funding=${t.type}`,
              color: COUNT_COLOR,
              value: t.trials + t.publications,
              valueLabel: (t.trials + t.publications).toLocaleString(),
              detail: `${t.trials} trials · ${t.publications} papers`,
            }))}
          />
        </Section>

        <Section title="Federal grant funding by year" subtitle="Money obligated each year, by funder">
          <YearBars caption="Funding by fiscal year and funder" data={trend.data} series={trend.series} height={240} />
        </Section>
      </div>

      <Section id="topics" title="Topics" action={{ href: "/topics", label: "All topics" }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {o.topics.slice(0, 8).map((t) => (
            <TopicTile key={t.id} topic={t} />
          ))}
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-12">
        <Section
          title="Clinical trials recruiting now"
          subtitle="Per ClinicalTrials.gov"
          action={{ href: "/search?kind=trial&status=active", label: `All ${o.totals.recruiting} recruiting` }}
        >
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.recruiting.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
        <Section title="Recent publications" action={{ href: "/search?kind=publication", label: "All publications" }}>
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.publications.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        <Section title="Recently started grants">
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.recent.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
        <Section title="Teams that cross colleges" subtitle="Investigators from two or more colleges">
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.crossCollege.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Where this data comes from">
        <SourceCards sources={o.sources} />
        <p className="text-small text-ink-3 mt-4">
          {o.updatedAt ? `Last imported ${shortDate(o.updatedAt)}. ` : ""}
          <Link href="/about#limits" className="text-cherry underline underline-offset-2">
            What this data can and can&apos;t tell you
          </Link>
        </p>
      </Section>
    </main>
  );
}
