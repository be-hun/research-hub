import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import Illustration from "@/components/Illustration";
import FilterGroup, { type FilterOption } from "@/components/opportunities/FilterGroup";
import OpportunityRow from "@/components/opportunities/OpportunityRow";
import OpportunitySearchForm from "@/components/opportunities/OpportunitySearchForm";
import Pagination from "@/components/opportunities/Pagination";
import { searchOpportunities, type OpportunityParams } from "@/lib/api";
import { CLOSES_WITHIN, GRANTS_GOV_SEARCH, opportunitiesHref, SORT_LABELS, STATUS_LABELS } from "@/lib/opportunities";
import type { FacetValue, OpportunitySort, OpportunityStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Funding opportunities" };

type Raw = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => list(v)[0];

const STATUSES: OpportunityStatus[] = ["posted", "forecasted", "closed"];
const SORTS: OpportunitySort[] = ["deadline", "relevance", "newest"];
/** No status in the URL means the backend's default: open and forecasted calls. */
const DEFAULT_STATUS: OpportunityStatus[] = ["posted", "forecasted"];

function parse(sp: Raw): OpportunityParams {
  const within = Number(one(sp.closes_within));
  const sort = one(sp.sort) as OpportunitySort | undefined;
  return {
    q: (one(sp.q) ?? "").trim(),
    page: Math.max(1, Math.floor(Number(one(sp.page)) || 1)),
    agencies: list(sp.agency),
    status: list(sp.status).filter((s): s is OpportunityStatus => STATUSES.includes(s as OpportunityStatus)),
    categories: list(sp.category),
    universities: one(sp.universities) === "true",
    closesWithin: Number.isFinite(within) && within > 0 ? Math.floor(within) : undefined,
    sort: sort && SORTS.includes(sort) ? sort : "deadline",
  };
}

/** Add or remove one value of a multi-value filter, back to page 1. */
function toggled(values: string[] | undefined, value: string): string[] {
  const cur = values ?? [];
  return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
}

/**
 * Closed calls are hidden unless asked for. Asking for them from the default (no status) keeps open and forecasted
 * too; a selection equal to the default goes back to no status, so the URL stays short.
 */
function toggledStatus(cur: OpportunityStatus[], value: OpportunityStatus): OpportunityStatus[] {
  const next = value === "closed" && !cur.length ? [...DEFAULT_STATUS, "closed" as const] : (toggled(cur, value) as OpportunityStatus[]);
  const isDefault = next.length === DEFAULT_STATUS.length && DEFAULT_STATUS.every((s) => next.includes(s));
  return isDefault ? [] : STATUSES.filter((s) => next.includes(s));
}

const facetOptions = (values: FacetValue[], selected: string[] | undefined, hrefFor: (v: string) => string): FilterOption[] =>
  values.map((v) => ({ key: v.value, label: v.label, count: v.count, href: hrefFor(v.value), on: !!selected?.includes(v.value) }));

export default async function OpportunitiesPage({ searchParams }: { searchParams: Raw }) {
  const params = parse(searchParams);
  const data = await searchOpportunities(params);
  const href = (p: Partial<OpportunityParams>) => opportunitiesHref({ ...params, page: 1, ...p });
  const status = params.status ?? [];
  const statusCount = (s: OpportunityStatus) => data.facets.status.find((f) => f.value === s)?.count;

  const selectedCount =
    (params.agencies?.length ?? 0) +
    status.length +
    (params.categories?.length ?? 0) +
    (params.universities ? 1 : 0) +
    (params.closesWithin != null ? 1 : 0);
  const filtered = selectedCount > 0;
  // Nothing at all, with no query and no filters: the Grants.gov import hasn't run for this copy of the site yet.
  const nothingLoaded = data.total === 0 && !params.q && !filtered;
  const pages = Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize)));
  const sort = data.sort ?? params.sort ?? "deadline";

  const statusOptions: FilterOption[] = STATUSES.filter((s) => s !== "closed" || status.includes("closed")).map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    count: statusCount(s),
    href: href({ status: toggledStatus(status, s) }),
    on: status.includes(s),
  }));

  const filters = (
    <>
      <FilterGroup
        title="Status"
        options={statusOptions}
        footer={
          !status.includes("closed") && (
            <Link href={href({ status: toggledStatus(status, "closed") })} className="inline-block mt-1 text-small text-cherry hover:underline">
              Include closed calls
            </Link>
          )
        }
      />
      <FilterGroup
        title="Closes within"
        single
        options={[
          { key: "any", label: "Any time", href: href({ closesWithin: undefined }), on: params.closesWithin == null },
          ...CLOSES_WITHIN.map((d) => ({ key: String(d), label: `${d} days`, href: href({ closesWithin: d }), on: params.closesWithin === d })),
        ]}
      />
      <FilterGroup
        title="Eligibility"
        options={[
          {
            key: "universities",
            label: "Open to universities",
            href: href({ universities: !params.universities }),
            on: !!params.universities,
          },
        ]}
      />
      <FilterGroup
        title="Agency"
        options={facetOptions(data.facets.agencies, params.agencies, (v) => href({ agencies: toggled(params.agencies, v) }))}
      />
      <FilterGroup
        title="Category"
        options={facetOptions(data.facets.categories, params.categories, (v) => href({ categories: toggled(params.categories, v) }))}
      />
      {filtered && (
        <Link href={opportunitiesHref({ q: params.q, sort: params.sort })} className="block text-small text-cherry hover:underline">
          Clear filters
        </Link>
      )}
    </>
  );

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8">
      <header className="max-w-3xl">
        <h1 className="text-[30px] leading-[38px] sm:text-h1">Funding opportunities</h1>
        <p className="text-lead text-ink-2 mt-2">
          Current federal funding calls from Grants.gov, refreshed daily. Deadlines and eligibility can change, so always
          confirm on Grants.gov before you apply.
        </p>
        <div className="mt-6">
          <OpportunitySearchForm params={params} />
        </div>
      </header>

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

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="results-heading" className="font-sans text-body text-ink-2" aria-live="polite">
              <span className="font-semibold text-ink num">{data.total.toLocaleString()}</span> {data.total === 1 ? "call" : "calls"}
              {params.q ? (
                <>
                  {" "}
                  matching <span className="font-semibold text-ink break-words">“{params.q}”</span>
                </>
              ) : null}
            </h2>
            <div className="flex flex-wrap items-center gap-1 text-small" role="group" aria-label="Sort">
              <span className="text-ink-3 mr-1">Sort</span>
              {SORTS.map((s) => (
                <Link
                  key={s}
                  href={href({ sort: s })}
                  aria-current={sort === s ? "true" : undefined}
                  className={`px-2.5 py-1 rounded-full ${sort === s ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`}
                >
                  {SORT_LABELS[s]}
                </Link>
              ))}
            </div>
          </div>

          {data.results.length ? (
            <ul className="bg-surface border border-line rounded-xl px-5">
              {data.results.map((o) => (
                <OpportunityRow key={o.id} opportunity={o} />
              ))}
            </ul>
          ) : nothingLoaded ? (
            <div className="bg-surface border border-line rounded-xl px-6 py-10 text-center">
              <Illustration variant="empty" className="w-48 mx-auto" />
              <p className="font-serif text-h3 mt-2">No funding calls loaded yet</p>
              <p className="text-small text-ink-2 mt-1 max-w-md mx-auto">
                Federal calls appear here after the daily Grants.gov import runs. Until then, every open call is on
                Grants.gov itself.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                <a
                  href={GRANTS_GOV_SEARCH}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cherry text-white text-small font-medium hover:bg-cherry-dark"
                >
                  Search Grants.gov ↗
                </a>
                <Link
                  href="/search?kind=award"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line-strong bg-surface text-small font-medium hover:border-ink-3"
                >
                  See Temple&apos;s past grants
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-xl px-6 py-10 text-center">
              <Illustration variant="empty" className="w-40 mx-auto" />
              <p className="font-serif text-h3 mt-2">No calls match {params.q ? "that search" : "these filters"}</p>
              <p className="text-small text-ink-2 mt-1">Try fewer words, a longer deadline window, or clear the filters.</p>
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 text-small">
                {filtered && (
                  <Link href={opportunitiesHref({ q: params.q, sort: params.sort })} className="text-cherry underline underline-offset-2">
                    Clear filters
                  </Link>
                )}
                {params.q && (
                  <Link href={opportunitiesHref({})} className="text-cherry underline underline-offset-2">
                    Show all calls
                  </Link>
                )}
                <a href={GRANTS_GOV_SEARCH} target="_blank" rel="noreferrer" className="text-cherry underline underline-offset-2">
                  Search Grants.gov ↗
                </a>
              </div>
            </div>
          )}

          <Pagination page={data.page} pages={pages} hrefFor={(page) => opportunitiesHref({ ...params, page })} />

          <p className="flex items-start gap-2 text-tiny text-ink-3 mt-6 max-w-3xl">
            <Icon name="info" size={18} className="mt-px" />
            <span>
              A call is an invitation to apply, not an award. Dates, award sizes and eligibility are copied from
              Grants.gov as the agency published them; ResearchConnect doesn&apos;t decide who can apply.
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
