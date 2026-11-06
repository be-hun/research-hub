import Link from "next/link";

export interface FilterOption {
  key: string;
  label: string;
  count?: number;
  href: string;
  on: boolean;
}

const SHOWN = 5;

/**
 * One filter as a list of links, styled like the facets on /search. `single` draws round markers for a choose-one
 * filter. Long lists show their first five options (and anything selected); the rest open without JavaScript.
 */
export default function FilterGroup({
  title,
  options,
  single = false,
  footer,
}: {
  title: string;
  options: FilterOption[];
  single?: boolean;
  footer?: React.ReactNode;
}) {
  if (!options.length) return null;
  const top = options.length > SHOWN + 1 ? options.filter((o, i) => i < SHOWN || o.on) : options;
  const more = options.filter((o) => !top.includes(o));
  const row = (o: FilterOption) => (
    <li key={o.key}>
      <Link
        href={o.href}
        aria-current={o.on ? "true" : undefined}
        className={`flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md text-small ${o.on ? "bg-cherry-tint text-cherry-dark font-semibold" : "text-ink-2 hover:bg-surface"}`}
      >
        <span
          className={`w-4 h-4 border flex items-center justify-center shrink-0 ${single ? "rounded-full" : "rounded"} ${o.on ? "bg-cherry border-cherry text-white" : "border-line-strong bg-surface"}`}
          aria-hidden="true"
        >
          {o.on ? (single ? <span className="w-1.5 h-1.5 rounded-full bg-white" /> : "✓") : ""}
        </span>
        <span className="truncate min-w-0">{o.label}</span>
        {o.count != null && <span className="ml-auto pl-2 num text-ink-3 shrink-0">{o.count.toLocaleString()}</span>}
      </Link>
    </li>
  );
  return (
    <fieldset className="min-w-0">
      <legend className="text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-2">{title}</legend>
      <ul className="space-y-0.5">{top.map(row)}</ul>
      {more.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-small text-cherry hover:underline px-2 -mx-2 py-1">Show {more.length} more</summary>
          <ul className="space-y-0.5 mt-1">{more.map(row)}</ul>
        </details>
      )}
      {footer}
    </fieldset>
  );
}
