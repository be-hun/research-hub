import type { Metadata } from "next";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import SearchBar from "@/components/SearchBar";
import { getPeople, matchProjects, peopleQueryString, searchProjects, searchQueryString, type SearchParams } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { demoProfileInput } from "@/lib/demo";
import { plainReasons } from "@/lib/matchReasons";
import type { CollegeId, FacetValue } from "@/lib/types";
import { CollegeTag } from "@/components/Tags";

export const metadata: Metadata = { title: "Search" };

type Raw = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function toggle(params: SearchParams, key: "colleges" | "funders" | "status" | "topics" | "kinds" | "funding", value: string): string {
  const current = params[key] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return `/search?${searchQueryString({ ...params, [key]: next, page: 1 })}`;
}

function FacetGroup({
  title,
  values,
  selected,
  hrefFor,
  dot,
}: {
  title: string;
  values: FacetValue[];
  selected: string[];
  hrefFor: (v: string) => string;
  dot?: (v: string) => string | undefined;
}) {
  if (!values.length) return null;
  // Long lists show their five largest values (and anything selected); the rest open on demand, without JavaScript.
  const top = values.length > SHOWN + 1 ? values.filter((v, i) => i < SHOWN || selected.includes(v.value)) : values;
  const more = values.filter((v) => !top.includes(v));
  const row = (v: FacetValue) => {
    const on = selected.includes(v.value);
    return (
      <li key={v.value}>
        <Link
          href={hrefFor(v.value)}
          aria-current={on ? "true" : undefined}
          className={`flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md text-small ${on ? "bg-cherry-tint text-cherry-dark font-semibold" : "text-ink-2 hover:bg-surface"}`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-cherry border-cherry text-white" : "border-line-strong bg-surface"}`}
            aria-hidden="true"
          >
            {on ? "✓" : ""}
          </span>
          {dot?.(v.value) && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot(v.value) }} aria-hidden="true" />}
          <span className="truncate min-w-0">{v.label}</span>
          <span className="ml-auto pl-2 num text-ink-3 shrink-0">{v.count}</span>
        </Link>
      </li>
    );
  };
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
    </fieldset>
  );
}

const SHOWN = 5;

/** 1 … 4 5 6 … 398: the first and last page, and the pages around the current one. */
function pageList(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = Array.from(wanted).sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

export default async function SearchPage({ searchParams }: { searchParams: Raw }) {
  const params: SearchParams = {
    q: (list(searchParams.q)[0] ?? "").trim(),
    page: Number(list(searchParams.page)[0]) || 1,
    colleges: list(searchParams.college),
    funders: list(searchParams.funder),
    status: list(searchParams.status),
    topics: list(searchParams.topic),
    kinds: list(searchParams.kind),
    funding: list(searchParams.funding),
  };
  const data = await searchProjects(params);
  // Demo account: mark the results on this page that match Maya's interests. A failure only drops the markers.
  const profile = demoProfileInput();
  const matches = profile
    ? await matchProjects(profile, data.results.map((p) => p.id)).catch(() => ({ matches: [] }))
    : { matches: [] };
  const matchReason = new Map(matches.matches.map((m) => [m.id, plainReasons(m.reasons)]));
  // A name or department in the query: show the matching people above the records (the box promises people too).
  const people = params.q && params.page === 1 ? await getPeople({ q: params.q }).catch(() => null) : null;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = [params.colleges, params.funders, params.status, params.topics, params.kinds, params.funding].some((v) => v?.length);
  const pageHref = (page: number) => `/search?${searchQueryString({ ...params, page })}`;

  const selectedCount = [params.colleges, params.funders, params.status, params.topics, params.kinds, params.funding].reduce((n, v) => n + (v?.length ?? 0), 0);
  const filters = (
    <>
      <FacetGroup
        title="Type"
        values={data.facets.kinds}
        selected={params.kinds ?? []}
        hrefFor={(v) => toggle(params, "kinds", v)}
      />
      <FacetGroup
        title="Status"
        values={data.facets.status}
        selected={params.status ?? []}
        hrefFor={(v) => toggle(params, "status", v)}
      />
      <FacetGroup
        title="College"
        values={data.facets.colleges.map((c) => ({ ...c, label: COLLEGES[c.value as CollegeId]?.short ?? c.label }))}
        selected={params.colleges ?? []}
        hrefFor={(v) => toggle(params, "colleges", v)}
        dot={(v) => COLLEGES[v as CollegeId]?.color}
      />
      <FacetGroup
        title="Funding type"
        values={data.facets.fundingTypes}
        selected={params.funding ?? []}
        hrefFor={(v) => toggle(params, "funding", v)}
      />
      <FacetGroup
        title="Grant funder"
        values={data.facets.funders}
        selected={params.funders ?? []}
        hrefFor={(v) => toggle(params, "funders", v)}
      />
      <FacetGroup
        title="Topic"
        values={data.facets.topics}
        selected={params.topics ?? []}
        hrefFor={(v) => toggle(params, "topics", v)}
      />
      {filtered && (
        <Link href={`/search?${searchQueryString({ q: params.q })}`} className="block text-small text-cherry hover:underline">
          Clear filters
        </Link>
      )}
    </>
  );

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8">
      <div className="max-w-3xl">
        <SearchBar defaultValue={params.q} />
        {params.q && (
          <p className="text-small text-ink-3 mt-2">
            <span className="font-medium text-ink-2">Searched for:</span> {data.interpretedAs.replace(/^Keywords: /, "")}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6 lg:gap-10 mt-8">
        {/* Phones: the filters fold into one button so the results come first. Larger screens: a sidebar. */}
        <details className="lg:hidden rounded-xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-small font-semibold text-ink flex items-center gap-2">
            Filters{selectedCount ? ` (${selectedCount} selected)` : ""}
          </summary>
          <div className="space-y-6 mt-4">{filters}</div>
        </details>
        <aside aria-label="Filters" className="hidden lg:block space-y-6 lg:sticky lg:top-24 self-start min-w-0">
          {filters}
        </aside>

        <section aria-label="Results" className="min-w-0">
          <h1 className="font-sans text-body text-ink-2 mb-2">
            <span className="font-semibold text-ink num">{data.total.toLocaleString()}</span>{" "}
            {data.total === 1 ? "record" : "records"}
            {params.q ? (
              <>
                {" "}matching <span className="font-semibold text-ink">“{params.q}”</span>
              </>
            ) : null}
          </h1>

          {people && people.total > 0 && (
            <div className="mb-5">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h2 className="font-sans text-small font-semibold text-ink">People matching “{params.q}”</h2>
                {people.total > 3 && (
                  <Link href={`/researchers?${peopleQueryString({ q: params.q })}`} className="text-small text-cherry hover:underline">
                    All {people.total.toLocaleString()} people →
                  </Link>
                )}
              </div>
              <ul className="grid sm:grid-cols-3 gap-3">
                {people.results.slice(0, 3).map((person) => (
                  <li key={person.researcherId}>
                    <Link
                      href={`/researchers/${person.researcherId}`}
                      className="block h-full rounded-xl border border-line bg-surface px-4 py-3 hover:border-cherry"
                    >
                      <span className="block text-body font-semibold text-ink break-words">{person.name}</span>
                      <span className="flex flex-wrap items-center gap-2 mt-1 text-small text-ink-3">
                        <CollegeTag id={person.college} />
                        <span className="num">
                          {person.counts.grants + person.counts.trials + person.counts.publications} records
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.results.length ? (
            <ul className="bg-surface border border-line rounded-xl px-5">
              {data.results.map((p) => (
                <AwardRow key={p.id} project={p} showSummary interestMatch={matchReason.get(p.id)} />
              ))}
            </ul>
          ) : (
            <div className="bg-surface border border-line rounded-xl p-8 text-center">
              <p className="font-serif text-h3">Nothing matches that search</p>
              <p className="text-small text-ink-3 mt-1">Try fewer words, a broader topic, or clear the filters.</p>
              <Link
                href="/ask"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-cherry text-white text-small font-medium hover:bg-cherry-dark"
              >
                Ask a question instead →
              </Link>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 mt-5 text-small">
              {data.page > 1 ? (
                <Link href={pageHref(data.page - 1)} className="px-3 py-2 rounded-md border border-line bg-surface hover:border-line-strong">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <ol className="flex flex-wrap items-center justify-center gap-1">
                {pageList(data.page, pages).map((n, i) =>
                  n === "gap" ? (
                    <li key={`gap-${i}`} className="px-1 text-ink-3" aria-hidden="true">…</li>
                  ) : (
                    <li key={n}>
                      <Link
                        href={pageHref(n)}
                        aria-current={n === data.page ? "page" : undefined}
                        aria-label={`Page ${n} of ${pages}`}
                        className={`num inline-block min-w-9 text-center px-2.5 py-2 rounded-md border ${
                          n === data.page ? "border-cherry bg-cherry-tint text-cherry-dark font-semibold" : "border-line bg-surface hover:border-line-strong"
                        }`}
                      >
                        {n}
                      </Link>
                    </li>
                  ),
                )}
              </ol>
              {data.page < pages ? (
                <Link href={pageHref(data.page + 1)} className="px-3 py-2 rounded-md border border-line bg-surface hover:border-line-strong">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
