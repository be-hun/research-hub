import Link from "next/link";

/** 1 … 4 5 6 … 398: the first and last page, and the pages around the current one (as on /search). */
function pageList(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = Array.from(wanted).sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

export default function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  const edge = "px-3 py-2 rounded-md border border-line bg-surface hover:border-line-strong";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 mt-5 text-small">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={edge}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <ol className="flex flex-wrap items-center justify-center gap-1">
        {pageList(page, pages).map((n, i) =>
          n === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-ink-3" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={hrefFor(n)}
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n} of ${pages}`}
                className={`num inline-block min-w-9 text-center px-2.5 py-2 rounded-md border ${
                  n === page ? "border-cherry bg-cherry-tint text-cherry-dark font-semibold" : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ol>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={edge}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
