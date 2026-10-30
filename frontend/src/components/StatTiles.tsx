import Link from "next/link";
import type { Totals } from "@/lib/types";

export default function StatTiles({ totals }: { totals: Totals }) {
  const tiles = [
    { value: totals.awards, label: "federally funded awards", href: "/search" },
    { value: totals.active, label: "active right now", href: "/search?status=active" },
    { value: totals.researchers, label: "investigators", href: "/explore#topics" },
    { value: totals.colleges, label: "colleges represented", href: "/explore#colleges" },
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-xl overflow-hidden border border-line">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="bg-surface px-5 py-5 hover:bg-canvas group">
          <dt className="sr-only">{t.label}</dt>
          <dd className="font-serif text-h1 num text-ink group-hover:text-cherry">{t.value.toLocaleString()}</dd>
          <dd className="text-small text-ink-3">{t.label}</dd>
        </Link>
      ))}
    </dl>
  );
}
