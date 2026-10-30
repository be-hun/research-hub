import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AwardRow from "@/components/AwardRow";
import BarList from "@/components/charts/BarList";
import YearBars from "@/components/charts/YearBars";
import Section from "@/components/Section";
import { CollegeTag } from "@/components/Tags";
import TopicTile from "@/components/TopicTile";
import { getTopic } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { count, money } from "@/lib/format";
import { trendData } from "@/lib/series";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = await getTopic(params.id);
  return { title: t?.topic.name ?? "Topic" };
}

export default async function TopicPage({ params }: { params: { id: string } }) {
  const t = await getTopic(params.id);
  if (!t) notFound();
  const trend = trendData(t.trend);

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-12">
      <nav aria-label="Breadcrumb" className="text-small text-ink-3">
        <Link href="/topics" className="hover:text-ink">Topics</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-ink-2">{t.topic.name}</span>
      </nav>

      <header className="grid md:grid-cols-[1.4fr_1fr] gap-8 items-center">
        <div>
          <h1 className="text-h1">{t.topic.name}</h1>
          <p className="text-lead text-ink-2 mt-2">{t.topic.blurb}</p>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 mt-6">
            {[
              [t.topic.awards.toLocaleString(), "awards"],
              [t.topic.active.toLocaleString(), "active"],
              [money(t.topic.funding), "since FY2022"],
            ].map(([v, l]) => (
              <div key={l}>
                <dd className="font-serif text-h1 num">{v}</dd>
                <dt className="text-small text-ink-3">{l}</dt>
              </div>
            ))}
          </dl>
          <Link
            href={`/search?topic=${t.topic.id}`}
            className="inline-block mt-6 px-4 py-2 rounded-lg bg-cherry text-white text-small font-medium hover:bg-cherry-dark"
          >
            Search within this topic
          </Link>
        </div>
        {t.topic.image && (
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
            <Image src={t.topic.image} alt="" fill sizes="(min-width: 768px) 440px, 100vw" className="object-cover" />
          </div>
        )}
      </header>

      <div className="grid lg:grid-cols-2 gap-12">
        <Section title="Colleges involved" subtitle="Funding since FY2022">
          <BarList
            caption={`${t.topic.name}: funding by college`}
            rows={t.byCollege.map((c) => ({
              key: c.college,
              label: COLLEGES[c.college].name,
              href: `/search?topic=${t.topic.id}&college=${c.college}`,
              color: COLLEGES[c.college].color,
              value: c.funding,
              valueLabel: money(c.funding),
              detail: `${c.awards} awards · ${c.active} active`,
            }))}
          />
        </Section>
        <Section title="Funding over time" subtitle="Money obligated each year, by funder">
          <YearBars caption={`${t.topic.name}: funding by fiscal year`} data={trend.data} series={trend.series} />
        </Section>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.6fr] gap-12">
        <Section title="Who works on this" subtitle="Investigators ranked by number of awards in this topic">
          <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
            {t.people.map((p) => (
              <li key={p.name} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/search?q=${encodeURIComponent(p.name)}`} className="font-medium hover:text-cherry">
                    {p.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-2 text-tiny text-ink-3">
                    <CollegeTag id={p.college} />
                    {p.department && <span>{p.department}</span>}
                  </div>
                </div>
                <span className="text-small text-ink-3 num shrink-0">{count(p.awards, "award")}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Awards to start with" subtitle="Active awards first, then the largest" action={{ href: `/search?topic=${t.topic.id}`, label: `All ${t.topic.awards}` }}>
          <ul className="bg-surface border border-line rounded-xl px-5">
            {t.projects.map((p) => (
              <AwardRow key={p.id} project={p} />
            ))}
          </ul>
        </Section>
      </div>

      {t.related.length > 0 && (
        <Section title="Related topics" subtitle="Topics that share the most investigators with this one">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {t.related.map((r) => (
              <TopicTile key={r.id} topic={r} />
            ))}
          </div>
        </Section>
      )}

      <p className="text-small text-ink-3">
        This topic includes awards funded by: {t.funders.join(" · ")}.
      </p>
    </main>
  );
}
