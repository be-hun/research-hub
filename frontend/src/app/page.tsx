import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import StatTiles from "@/components/StatTiles";
import { getOverview } from "@/lib/api";
import { shortDate } from "@/lib/format";

const EXAMPLES = ["machine learning", "battery energy storage", "opioid addiction", "Alzheimer's disease"];

export default async function HomePage() {
  const o = await getOverview();

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

      <div className="max-w-page mx-auto px-4 sm:px-6 space-y-16 pt-12">
        <div>
          <StatTiles totals={o.totals} />
          <p className="text-tiny text-ink-3 mt-2">
            Sources: {o.sources.map((s) => s.label).join(", ")}
            {o.updatedAt ? ` · updated ${shortDate(o.updatedAt)}` : ""}
          </p>
        </div>

        <div>
          <h2 className="font-serif text-h2 text-ink mb-4">Start exploring</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                href: "/search",
                title: "Search research",
                text: "Find grants, trials, publications and topics.",
              },
              {
                href: "/researchers",
                title: "Find researchers",
                text: "Explore people and their research records.",
              },
              {
                href: "/opportunities",
                title: "Find funding",
                text: "Search open federal funding calls from Grants.gov.",
              },
              {
                href: "/ask",
                title: "Ask a question",
                text: "Search Temple research in plain language.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-surface border border-line rounded-xl p-5 hover:border-cherry hover:shadow-card transition-shadow"
              >
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="text-small text-ink-2 mt-1">{item.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
