import type { Metadata } from "next";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import SearchBar from "@/components/SearchBar";
import { matchProjects, searchProjects, searchQueryString, type SearchParams } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { demoProfileInput } from "@/lib/demo";
import { plainReasons } from "@/lib/matchReasons";
import type { CollegeId, FacetValue } from "@/lib/types";

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
  return (
    <fieldset className="min-w-0">
      <legend className="text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-2">{title}</legend>
      <ul className="space-y-0.5">
        {values.map((v) => {
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
        })}
      </ul>
    </fieldset>
  );
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
  const matchReason = new Map(matches.matches.map((m) => [m.id, plainReasons(m.reasons, profile?.terms)]));
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = [params.colleges, params.funders, params.status, params.topics, params.kinds, params.funding].some((v) => v?.length);
  const pageHref = (page: number) => `/search?${searchQueryString({ ...params, page })}`;

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

      <div className="grid lg:grid-cols-[240px_1fr] gap-10 mt-8">
        <aside aria-label="Filters" className="space-y-6 lg:sticky lg:top-24 self-start min-w-0">
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
        </aside>

        <section aria-label="Results">
          <h1 className="font-sans text-body text-ink-2 mb-2">
            <span className="font-semibold text-ink num">{data.total.toLocaleString()}</span>{" "}
            {data.total === 1 ? "record" : "records"}
            {params.q ? (
              <>
                {" "}matching <span className="font-semibold text-ink">“{params.q}”</span>
              </>
            ) : null}
          </h1>

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
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between mt-5 text-small">
              {data.page > 1 ? (
                <Link href={pageHref(data.page - 1)} className="px-3 py-2 rounded-md border border-line bg-surface hover:border-line-strong">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-3 num">
                Page {data.page} of {pages}
              </span>
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
