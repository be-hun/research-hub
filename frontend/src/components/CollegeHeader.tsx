import Link from "next/link";
import CampusPhoto from "@/components/CampusPhoto";
import { COLLEGES } from "@/lib/colleges";
import type { CollegeId } from "@/lib/types";
import { money, shortDate } from "@/lib/format";
import { PHOTOS } from "@/lib/photos";
import type { CollegeDashboard } from "@/lib/types";

/** College name, data date and the headline counts. Every tile opens the records behind it. */
export default function CollegeHeader({ d }: { d: CollegeDashboard }) {
  const c = d.college;
  const fy = d.fundingYears.length ? `FY${d.fundingYears[0]}–FY${d.fundingYears[1]}` : "since FY2022";
  const tiles = [
    { value: c.awards.toLocaleString(), label: "grants", detail: `${c.active.toLocaleString()} active`, href: `/search?college=${c.id}&kind=award` },
    { value: c.trials.toLocaleString(), label: "clinical trials", detail: "any status", href: `/search?college=${c.id}&kind=trial` },
    { value: c.publications.toLocaleString(), label: "funded publications", detail: "since 2024", href: `/search?college=${c.id}&kind=publication` },
    { value: money(c.funding) === "—" ? "$0" : money(c.funding), label: "grant money", detail: fy, href: `/search?college=${c.id}&kind=award` },
    { value: c.researchers.toLocaleString(), label: "researchers", detail: "assigned to this college", href: `/researchers?college=${c.id}` },
  ];
  return (
    <header>
      <nav aria-label="Switch college" className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto mb-6">
        <ul className="flex gap-2 w-max">
          {(Object.keys(COLLEGES) as CollegeId[]).map((id) => {
            const on = id === c.id;
            return (
              <li key={id}>
                <Link
                  href={`/colleges/${id}`}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-small border whitespace-nowrap ${on ? "bg-ink text-white border-ink" : "bg-surface border-line text-ink-2 hover:border-ink-3"}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: COLLEGES[id].color }} aria-hidden="true" />
                  {COLLEGES[id].short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLLEGES[c.id].color }} aria-hidden="true" />
            <h1 className="text-h1">{c.name}</h1>
          </div>
          <p className="text-lead text-ink-2 mt-2">
            Public grants, clinical trials and funded publications that name this college, and the people on them.
          </p>
          {d.updatedAt && <p className="text-small text-ink-3 mt-1">Data updated {shortDate(d.updatedAt)}</p>}
          <div className="flex flex-wrap gap-3 mt-5">
            <Link href={`/search?college=${c.id}`} className="px-4 py-2 rounded-lg bg-cherry text-white text-small font-medium hover:bg-cherry-dark">
              Search this college&apos;s records
            </Link>
            <Link href={`/researchers?college=${c.id}`} className="px-4 py-2 rounded-lg border border-line-strong bg-surface text-small font-medium hover:border-cherry hover:text-cherry">
              Browse its people
            </Link>
          </div>
        </div>
        <CampusPhoto photo={PHOTOS[c.id]} className="w-full md:max-w-md md:justify-self-end" priority />
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-line rounded-xl overflow-hidden border border-line mt-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="bg-surface px-5 py-5 hover:bg-canvas group">
            <dt className="sr-only">{t.label}</dt>
            <dd className="font-serif text-h1 num text-ink group-hover:text-cherry">{t.value}</dd>
            <dd className="text-small text-ink-2" aria-hidden="true">{t.label}</dd>
            <dd className="text-tiny text-ink-3 num">{t.detail}</dd>
          </Link>
        ))}
      </dl>
    </header>
  );
}
