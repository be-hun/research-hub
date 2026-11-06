import Image from "next/image";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import BarList from "@/components/charts/BarList";
import ForYou from "@/components/ForYou";
import Icon from "@/components/Icon";
import SearchBar from "@/components/SearchBar";
import Section from "@/components/Section";
import StatTiles from "@/components/StatTiles";
import TopicTile from "@/components/TopicTile";
import { getForYou, getOverview } from "@/lib/api";
import { AUDIENCES } from "@/lib/audiences";
import { COLLEGES } from "@/lib/colleges";
import { demoProfileInput } from "@/lib/demo";
import { count, money, shortDate } from "@/lib/format";

const EXAMPLES = ["machine learning", "battery energy storage", "opioid addiction", "Alzheimer's disease"];

export default async function HomePage() {
  const profile = demoProfileInput();
  const [o, forYou] = await Promise.all([getOverview(), profile ? getForYou(profile).catch(() => null) : null]);

  return (
    <main>
      {/* Hero */}
      <section className="max-w-page mx-auto px-4 sm:px-6 pt-12 pb-8 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
        <div>
          <p className="text-small font-semibold text-cherry mb-3">Temple University research, in one place</p>
          <h1 className="text-[40px] leading-[46px] sm:text-display font-serif text-ink">
            See the research happening across Temple
          </h1>
          <p className="text-lead text-ink-2 mt-4 mb-7 max-w-xl">
            {o.totals.awards.toLocaleString()} grants, {o.totals.trials.toLocaleString()} clinical trials and{" "}
            {o.totals.publications.toLocaleString()} funded papers across {o.totals.colleges} colleges.
          </p>
          <SearchBar size="lg" placeholder="Try: machine learning in healthcare" />
          <Link
            href="/ask"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cherry text-cherry text-small font-semibold hover:bg-cherry-tint"
          >
            <Icon name="auto_awesome" size={18} />
            Or ask a question: “Who studies Alzheimer’s disease?”
          </Link>
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
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card hidden sm:block">
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

      <section aria-label="Who it is for" className="max-w-page mx-auto px-4 sm:px-6 pb-10">
        <ul className="grid sm:grid-cols-3 gap-3">
          {AUDIENCES.map((a) => (
            <li key={a.title} className="rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-small font-semibold text-ink">{a.title}</p>
              <p className="text-small text-ink-2">{a.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Demo account: a compact strip of Maya's matches, under the pitch */}
      {forYou && (
        <section className="bg-surface border-y border-line">
          <div className="max-w-page mx-auto px-4 sm:px-6 py-10">
            <Section
              title="For you, Maya"
              subtitle="New and active research that shares your interests. Synthetic demo account."
              action={{ href: "/account#for-you", label: "See all and edit interests" }}
            >
              <ForYou data={forYou} limit={3} />
            </Section>
          </div>
        </section>
      )}

      <div className="max-w-page mx-auto px-4 sm:px-6 space-y-16 pt-12">
        <div>
          <StatTiles totals={o.totals} />
          <p className="text-tiny text-ink-3 mt-2">
            Sources: {o.sources.map((s) => s.label).join(", ")}
            {o.updatedAt ? ` · updated ${shortDate(o.updatedAt)}` : ""}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12">
          <Section
            title="Where the funding goes"
            subtitle="Grant money obligated since FY2022, by college"
            action={{ href: "/explore", label: "Explore all data" }}
          >
            <BarList
              caption="Funding by college since fiscal year 2022"
              rows={o.byCollege.filter((c) => c.funding > 0).map((c) => ({
                key: c.college,
                label: COLLEGES[c.college].short,
                href: `/search?college=${c.college}`,
                color: COLLEGES[c.college].color,
                value: c.funding,
                valueLabel: money(c.funding),
                detail: [count(c.awards, "grant"), count(c.trials, "trial"), count(c.publications, "paper")].join(" · "),
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

        <div className="grid lg:grid-cols-2 gap-12">
          <Section title="Recently started grants" action={{ href: "/search?kind=award&status=active", label: "All active grants" }}>
            <ul className="bg-surface border border-line rounded-xl px-5">
              {o.recent.slice(0, 4).map((p) => (
                <AwardRow key={p.id} project={p} />
              ))}
            </ul>
          </Section>
          <Section title="Clinical trials recruiting now" action={{ href: "/search?kind=trial&status=active", label: `All ${o.totals.recruiting}` }}>
            <ul className="bg-surface border border-line rounded-xl px-5">
              {o.recruiting.slice(0, 4).map((p) => (
                <AwardRow key={p.id} project={p} />
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </main>
  );
}
