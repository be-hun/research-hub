import type { Metadata } from "next";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import Icon from "@/components/Icon";
import SearchBar from "@/components/SearchBar";
import { getPeople, matchProjects, peopleQueryString, searchProjects, searchQueryString, type SearchParams } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { count } from "@/lib/format";
import { demoProfileInput } from "@/lib/demo";
import { plainReasons } from "@/lib/matchReasons";
import type { CollegeId, FacetValue, PersonSummary } from "@/lib/types";
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

/** A name search's answer: the person, with enough to recognise them before opening the profile. */
function PersonCard({ person }: { person: PersonSummary }) {
  const c = person.counts;
  const totals = [c.grants && count(c.grants, "grant"), c.trials && count(c.trials, "trial"), c.publications && count(c.publications, "paper")].filter(Boolean);
  return (
    <Link
      href={`/researchers/${person.researcherId}`}
      className="group flex gap-4 h-full rounded-xl border border-line bg-surface p-5 hover:border-cherry shadow-card"
    >
      <span
        className="w-12 h-12 rounded-full bg-cherry-tint text-cherry font-serif font-semibold flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        {person.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-h3 text-ink group-hover:text-cherry break-words">{person.name}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-small text-ink-3">
          <CollegeTag id={person.college} short={false} />
          {person.department && <span className="break-words">{person.department}</span>}
        </span>
        {totals.length > 0 && <span className="block mt-2 text-small text-ink-2 num">{totals.join(" · ")} at Temple</span>}
        {person.topics.length > 0 && (
          <span className="block mt-1 text-small text-ink-3">Works on {person.topics.map((t) => t.name).join(", ")}</span>
        )}
        <span className="inline-flex items-center gap-1 mt-3 text-small font-medium text-cherry">
          View profile <Icon name="arrow_forward" size={16} />
        </span>
      </span>
    </Link>
  );
}

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
  // A name or department in the query: show the matching people above the records (the box promises people too).
  const [data, people] = await Promise.all([
    searchProjects(params),
    params.q && params.page === 1 ? getPeople({ q: params.q }).catch(() => null) : null,
  ]);
  // Demo account: mark the results on this page that match Maya's interests. A failure only drops the markers.
  const profile = demoProfileInput();
  const matches = profile
    ? await matchProjects(profile, data.results.map((p) => p.id)).catch(() => ({ matches: [] }))
    : { matches: [] };
  const interest = new Map(matches.matches.map((m) => [m.id, m]));
  // A few people and nothing else: the query is most likely a name, so the people are the answer and come first.
  const nameSearch = !!people && people.total > 0 && people.total <= 3;
  const CountHeading = nameSearch ? "h2" : "h1"; // the people are the page's answer on a name search
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  // Several words without quotes: say quotes force an exact phrase (the backend reads them with websearch_to_tsquery).
  const quoteHint = data.matchMode !== "phrase" && !params.q.includes('"') && params.q.split(/\s+/).length > 1;
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
            {quoteHint && <> · Use quotes for an exact phrase, like &quot;{params.q}&quot;</>}
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
          {nameSearch && people && (
            <div className="mb-8">
              <h1 className="font-sans text-body text-ink-2 mb-3">
                <span className="font-semibold text-ink num">{people.total}</span> {people.total === 1 ? "person" : "people"} matching{" "}
                <span className="font-semibold text-ink">“{params.q}”</span>
              </h1>
              <ul className={`grid gap-3 ${people.total > 1 ? "md:grid-cols-2" : ""}`}>
                {people.results.map((person) => (
                  <li key={person.researcherId}>
                    <PersonCard person={person} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <CountHeading className="font-sans text-body text-ink-2 mb-2">
            <span className="font-semibold text-ink num">{data.total.toLocaleString()}</span>{" "}
            {data.total === 1 ? "record" : "records"}
            {params.q ? (
              <>
                {" "}matching <span className="font-semibold text-ink">“{params.q}”</span>
              </>
            ) : null}
            {data.matchMode === "phrase" && (
              <span className="ml-2 align-middle inline-flex px-2 py-0.5 rounded-full bg-active-bg text-active-ink text-tiny font-semibold whitespace-nowrap">
                Exact phrase
              </span>
            )}
          </CountHeading>

          {data.matchMode === "any" && data.total > 0 && (
            <p className="flex items-start gap-2 text-small text-ink-2 bg-surface border border-line rounded-lg px-3 py-2 mb-4">
              <Icon name="info" size={18} className="text-ink-3 mt-px" />
              <span>No record has all of these words together. Showing records with any of them.</span>
            </p>
          )}

          {!nameSearch && people && people.total > 0 && (
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
              {data.results.map((p) => {
                const m = interest.get(p.id);
                return <AwardRow key={p.id} project={p} showSummary interestBand={m?.band} interestMatch={m && plainReasons(m.reasons)} />;
              })}
            </ul>
          ) : nameSearch ? null : (
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
