// How much a match overlaps with the signed-in profile, in the backend's words (`band_for` in
// backend/app/compatibility.py). The text carries the meaning; the color and the little bars repeat it.
const BANDS: Record<string, { level: number; className: string }> = {
  "Strong overlap": { level: 3, className: "bg-cherry text-white" },
  "Good overlap": { level: 2, className: "bg-cherry-tint text-cherry-dark" },
  "Some overlap": { level: 1, className: "bg-surface border border-line-strong text-ink-2" },
};

export default function BandPill({ band, className = "" }: { band: string | null | undefined; className?: string }) {
  if (!band) return null;
  const b = BANDS[band] ?? BANDS["Some overlap"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-tiny font-semibold whitespace-nowrap ${b.className} ${className}`}
    >
      <span className="inline-flex items-end gap-[2px] h-2.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`w-[3px] rounded-sm bg-current ${n <= b.level ? "" : "opacity-25"}`}
            style={{ height: `${3 + n * 2.5}px` }}
          />
        ))}
      </span>
      {band}
    </span>
  );
}
