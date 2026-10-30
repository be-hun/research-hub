import Link from "next/link";
import type { Totals } from "@/lib/types";

export default function StatTiles({ totals }: { totals: Totals }) {
  const tiles = [
    { value: totals.awards, label: "grants", detail: `${totals.active.toLocaleString()} active`, href: "/search?kind=award" },
    { value: totals.trials, label: "clinical trials", detail: `${totals.recruiting.toLocaleString()} recruiting`, href: "/search?kind=trial&status=active" },
    { value: totals.publications, label: "funded publications", detail: "since 2024", href: "/search?kind=publication" },
    { value: totals.researchers, label: "researchers", detail: `in ${totals.colleges} colleges`, href: "/explore#colleges" },
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-xl overflow-hidden border border-line">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="bg-surface px-5 py-5 hover:bg-canvas group">
          <dt className="sr-only">{t.label}</dt>
          <dd className="font-serif text-h1 num text-ink group-hover:text-cherry">{t.value.toLocaleString()}</dd>
          <dd className="text-small text-ink-2">{t.label}</dd>
          <dd className="text-tiny text-ink-3 num">{t.detail}</dd>
        </Link>
      ))}
    </dl>
  );
}
