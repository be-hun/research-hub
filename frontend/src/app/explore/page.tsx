import type { Metadata } from "next";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import BarList from "@/components/charts/BarList";
import YearBars from "@/components/charts/YearBars";
import Section from "@/components/Section";
import StatTiles from "@/components/StatTiles";
import TopicTile from "@/components/TopicTile";
import { getOverview } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { money, shortDate } from "@/lib/format";
import { trendData } from "@/lib/series";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage() {
  const o = await getOverview();
  const trend = trendData(o.trend);
  const firstFy = o.trend[0]?.fiscalYear;
  const lastFy = o.trend[o.trend.length - 1]?.fiscalYear;

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10 space-y-14">
      <header className="max-w-3xl">
        <h1 className="text-h1">Temple research at a glance</h1>
        <p className="text-lead text-ink-2 mt-2">
          {o.totals.awards.toLocaleString()} federally funded awards from {o.sources.map((s) => s.label).join(" and ")},
          FY{firstFy}–FY{lastFy}. Click any number to see the awards behind it.
        </p>
      </header>

      <StatTiles totals={o.totals} />

      <div className="grid lg:grid-cols-2 gap-12">
        <Section id="colleges" title="Funding by college" subtitle={`Money obligated FY${firstFy}–FY${lastFy}`}>
          <BarList
            caption="Funding by college"
            rows={o.byCollege.map((c) => ({
              key: c.college,
              label: COLLEGES[c.college].name,
              href: `/search?college=${c.college}`,
              color: COLLEGES[c.college].color,
              value: c.funding,
              valueLabel: money(c.funding),
              detail: `${c.awards} awards · ${c.active} active`,
            }))}
          />
        </Section>

        <Section title="Funding by fiscal year" subtitle="Money obligated each year, by funder">
          <YearBars caption="Funding by fiscal year and funder" data={trend.data} series={trend.series} height={240} />
        </Section>
      </div>

      <Section id="topics" title="Topics" subtitle="Grouped by the institute or division that funded each award" action={{ href: "/topics", label: "All topics" }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {o.topics.slice(0, 8).map((t) => (
            <TopicTile key={t.id} topic={t} />
          ))}
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-12">
        <Section title="Recently started" subtitle="The newest active awards">
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.recent.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
        <Section title="Teams that cross colleges" subtitle="Awards whose investigators come from more than one college">
          <ul className="bg-surface border border-line rounded-xl px-5">
            {o.crossCollege.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Where this data comes from">
        <div className="grid sm:grid-cols-2 gap-4">
          {o.sources.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block bg-surface border border-line rounded-xl p-5 hover:border-line-strong"
            >
              <div className="font-semibold">{s.label} ↗</div>
              <div className="font-serif text-h2 num mt-1">{s.awards.toLocaleString()} awards</div>
              <div className="text-small text-ink-3">{s.coverage}</div>
            </a>
          ))}
        </div>
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
