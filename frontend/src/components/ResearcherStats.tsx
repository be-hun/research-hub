import type { ResearcherCounts } from "@/lib/types";

/** Record counts. Numbers come from the API's SQL counts, never from the list on screen. */
export default function ResearcherStats({ counts }: { counts: ResearcherCounts }) {
  const tiles = [
    { value: counts.grants, label: counts.grants === 1 ? "grant" : "grants" },
    { value: counts.trials, label: counts.trials === 1 ? "clinical trial" : "clinical trials" },
    { value: counts.publications, label: counts.publications === 1 ? "publication" : "publications" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-px bg-line rounded-xl overflow-hidden border border-line">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface px-4 sm:px-5 py-4 flex flex-col-reverse">
          <dt className="text-small text-ink-2">{t.label}</dt>
          <dd className="font-serif text-h2 sm:text-h1 num text-ink">{t.value.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}
