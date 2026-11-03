import Link from "next/link";
import { COLLEGES } from "@/lib/colleges";
import { money, shortDate } from "@/lib/format";
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
    { value: c.researchers.toLocaleString(), label: "researchers", detail: "assigned to this college", href: "#researchers" },
  ];
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLLEGES[c.id].color }} aria-hidden="true" />
        <h1 className="text-h1">{c.name}</h1>
      </div>
      <p className="text-lead text-ink-2 mt-2">Public research records across Temple</p>
      {d.updatedAt && <p className="text-small text-ink-3 mt-1">Data updated {shortDate(d.updatedAt)}</p>}
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
