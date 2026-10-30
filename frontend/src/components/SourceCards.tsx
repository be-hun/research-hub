import type { SourceSummary } from "@/lib/types";

export default function SourceCards({ sources }: { sources: SourceSummary[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sources.map((s) => (
        <a
          key={s.label}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="block bg-surface border border-line rounded-xl p-5 hover:border-line-strong"
        >
          <div className="font-semibold">{s.label} ↗</div>
          <div className="font-serif text-h2 num mt-1">
            {s.records.toLocaleString()} <span className="text-h3 text-ink-2">{s.kind}</span>
          </div>
          <div className="text-small text-ink-3">{s.coverage}</div>
        </a>
      ))}
    </div>
  );
}
