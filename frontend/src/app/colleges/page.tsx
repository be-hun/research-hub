import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import CampusPhoto, { PhotoCredit } from "@/components/CampusPhoto";
import { getColleges } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { count, money } from "@/lib/format";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = { title: "Colleges" };

export default async function CollegesPage() {
  // Alphabetical, so the order never suggests a ranking.
  const colleges = (await getColleges()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-8">
      <header className="grid md:grid-cols-[1.5fr_1fr] gap-6 items-center">
        <div>
          <h1 className="text-h1">Colleges</h1>
          <p className="text-lead text-ink-2 mt-2 max-w-3xl">
            Public grants, clinical trials and funded publications, by the college each source names. Pick a college to
            see its funding, topics, people and cross-college work.
          </p>
          <p className="text-small text-ink-3 mt-2">Listed alphabetically. Record counts and funding are not measures of research quality.</p>
        </div>
        <CampusPhoto photo={PHOTOS.colleges} className="w-full md:max-w-md md:justify-self-end" aspect="aspect-[16/9]" priority />
      </header>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {colleges.map((c) => {
          const total = c.awards + c.trials + c.publications;
          return (
            <li key={c.id}>
              <Link
                href={`/colleges/${c.id}`}
                className="block h-full bg-surface border border-line rounded-xl overflow-hidden hover:border-cherry group"
              >
                <span className="relative block aspect-[16/7] bg-canvas">
                  <Image src={PHOTOS[c.id].src} alt="" fill sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                </span>
                <span className="block px-5 pt-4 pb-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLLEGES[c.id].color }} aria-hidden="true" />
                  <h2 className="text-h3 group-hover:text-cherry">{c.name}</h2>
                </div>
                {total === 0 ? (
                  <p className="text-small text-ink-3 mt-3">No records mapped to this college yet.</p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-small">
                    {[
                      [count(c.awards, "grant"), `${c.active.toLocaleString()} active`],
                      [count(c.trials, "clinical trial"), "any status"],
                      [count(c.publications, "paper"), "since 2024"],
                      [money(c.funding), "grant money since FY2022"],
                    ].map(([v, l]) => (
                      // The label is the term and the number its value, shown number-first: each is read once.
                      <div key={l} className="flex flex-col-reverse">
                        <dt className="text-tiny text-ink-3">{l}</dt>
                        <dd className="font-semibold num">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <section aria-label="Photo credits" className="text-tiny text-ink-3 space-y-1">
        <p>Card photos:</p>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {colleges.map((c) => (
            <li key={c.id}>
              <PhotoCredit photo={PHOTOS[c.id]} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
