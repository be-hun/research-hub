import type { Metadata } from "next";
import Link from "next/link";
import { ConfidenceChip } from "@/components/ConfidenceNotice";
import Icon from "@/components/Icon";
import CampusPhoto from "@/components/CampusPhoto";
import Illustration from "@/components/Illustration";
import { CollegeTag } from "@/components/Tags";
import { getPeople, peopleQueryString } from "@/lib/api";
import { COLLEGES } from "@/lib/colleges";
import { count } from "@/lib/format";
import { PHOTOS } from "@/lib/photos";
import type { CollegeId, PeopleParams } from "@/lib/types";

export const metadata: Metadata = { title: "People" };

type Raw = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => list(v)[0];

const KINDS = [
  { value: "", label: "Any record" },
  { value: "award", label: "Has grants" },
  { value: "trial", label: "Has clinical trials" },
  { value: "publication", label: "Has publications" },
];

const href = (p: PeopleParams) => {
  const qs = peopleQueryString(p);
  return qs ? `/researchers?${qs}` : "/researchers";
};

export default async function PeoplePage({ searchParams }: { searchParams: Raw }) {
  const params: PeopleParams = {
    q: one(searchParams.q) ?? "",
    page: Number(one(searchParams.page) ?? 1) || 1,
    colleges: list(searchParams.college),
    kind: one(searchParams.kind) ?? "",
    sort: one(searchParams.sort) ?? "records",
  };
  const r = await getPeople(params);
  const first = (r.page - 1) * r.pageSize + 1;
  const last = Math.min(r.page * r.pageSize, r.total);
  const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
  const filtered = Boolean(params.q || params.colleges?.length || params.kind);
  const toggleCollege = (c: string) => {
    const cur = params.colleges ?? [];
    return href({ ...params, page: 1, colleges: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
  };

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-8">
      <header className="grid md:grid-cols-[1.4fr_1fr] gap-6 items-center">
        <div>
          <h1 className="text-h1">People behind Temple research</h1>
          <p className="text-lead text-ink-2 mt-2">
            Researchers named on public grants, clinical trials and funded publications. Open a profile to see their
            records, who they are listed with, and where the data comes from.
          </p>
          <form action="/researchers" role="search" className="mt-6 flex gap-2 max-w-xl">
            <label htmlFor="people-q" className="sr-only">
              Search by name or department
            </label>
            <div className="relative flex-1">
              <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="people-q"
                name="q"
                defaultValue={params.q}
                placeholder="Search by name or department"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-line-strong bg-surface text-body placeholder:text-ink-3"
              />
            </div>
            {params.colleges?.map((c) => <input key={c} type="hidden" name="college" value={c} />)}
            {params.kind && <input type="hidden" name="kind" value={params.kind} />}
            {params.sort !== "records" && <input type="hidden" name="sort" value={params.sort} />}
            <button className="px-5 rounded-lg bg-cherry text-white text-small font-semibold hover:bg-cherry-dark">Search</button>
          </form>
        </div>
        <CampusPhoto photo={PHOTOS.people} className="hidden md:block w-full max-w-md justify-self-end" priority />
      </header>

      <div className="grid lg:grid-cols-[15rem_1fr] gap-8">
        <aside className="space-y-6" aria-label="Filters">
          <fieldset>
            <legend className="text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-2">College</legend>
            <ul className="space-y-0.5">
              {r.colleges.map((c) => {
                const on = params.colleges?.includes(c.value);
                return (
                  <li key={c.value}>
                    <Link
                      href={toggleCollege(c.value)}
                      aria-current={on ? "true" : undefined}
                      className={`flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md text-small ${on ? "bg-cherry-tint text-cherry-dark font-semibold" : "text-ink-2 hover:bg-surface"}`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLLEGES[c.value as CollegeId].color }} aria-hidden="true" />
                      <span className="truncate">{COLLEGES[c.value as CollegeId].short}</span>
                      <span className="ml-auto num text-ink-3">{c.count.toLocaleString()}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <fieldset>
            <legend className="text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-2">Records</legend>
            <ul className="space-y-0.5">
              {KINDS.map((k) => {
                const on = (params.kind ?? "") === k.value;
                return (
                  <li key={k.value}>
                    <Link
                      href={href({ ...params, page: 1, kind: k.value })}
                      aria-current={on ? "true" : undefined}
                      className={`block px-2 py-1.5 -mx-2 rounded-md text-small ${on ? "bg-cherry-tint text-cherry-dark font-semibold" : "text-ink-2 hover:bg-surface"}`}
                    >
                      {k.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          {filtered && (
            <Link href="/researchers" className="inline-block text-small text-cherry underline underline-offset-2">
              Clear all filters
            </Link>
          )}
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="results-heading" className="text-small text-ink-2" aria-live="polite">
              {r.total === 0 ? "No people found" : `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${count(r.total, "person", "people")}`}
              {params.q ? ` for “${params.q}”` : ""}
            </h2>
            <div className="flex items-center gap-1 text-small" role="group" aria-label="Sort">
              <span className="text-ink-3 mr-1">Sort</span>
              {[
                ["records", "Most records"],
                ["name", "A–Z"],
              ].map(([v, l]) => (
                <Link
                  key={v}
                  href={href({ ...params, page: 1, sort: v })}
                  aria-current={r.sort === v ? "true" : undefined}
                  className={`px-2.5 py-1 rounded-full ${r.sort === v ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>

          {r.total === 0 ? (
            <div className="bg-surface border border-line rounded-xl px-6 py-10 text-center">
              <Illustration variant="empty" className="w-48 mx-auto" />
              <p className="text-body text-ink-2 mt-2">No one matches these filters. Try a shorter name or fewer filters.</p>
              <Link href="/researchers" className="inline-block mt-3 text-cherry underline underline-offset-2">
                Show everyone
              </Link>
            </div>
          ) : (
            <ul className="bg-surface border border-line rounded-xl divide-y divide-line">
              {r.results.map((p) => (
                <li key={p.researcherId}>
                  <Link href={`/researchers/${p.researcherId}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-canvas group">
                    <span
                      className="w-10 h-10 rounded-full bg-cherry-tint text-cherry font-semibold text-small flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      {p.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink group-hover:text-cherry">{p.name}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-tiny text-ink-3 mt-0.5">
                        <CollegeTag id={p.college} />
                        {p.department && <span className="truncate max-w-[16rem]">{p.department}</span>}
                        {p.identityConfidence !== "high" && <ConfidenceChip confidence={p.identityConfidence} />}
                      </span>
                      {p.topics.length > 0 && (
                        <span className="flex flex-wrap gap-1.5 mt-1.5">
                          {p.topics.map((t) => (
                            <span key={t.id} className="px-2 py-0.5 rounded-full bg-canvas border border-line text-tiny text-ink-2">
                              {t.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:block text-small text-ink-2 num text-right shrink-0">
                      {[
                        p.counts.grants && count(p.counts.grants, "grant"),
                        p.counts.trials && count(p.counts.trials, "trial"),
                        p.counts.publications && count(p.counts.publications, "paper"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <Icon name="chevron_right" size={20} className="text-ink-3 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between mt-4 text-small">
              {r.page > 1 ? (
                <Link href={href({ ...params, page: r.page - 1 })} className="px-3 py-2 rounded-md border border-line bg-surface hover:border-cherry">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-3 num">
                Page {r.page} of {pages}
              </span>
              {r.page < pages ? (
                <Link href={href({ ...params, page: r.page + 1 })} className="px-3 py-2 rounded-md border border-line bg-surface hover:border-cherry">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          <p className="text-tiny text-ink-3 mt-6">
            Profiles are built from public records and have not been confirmed by the researchers. Some people appear
            under more than one name, and people who share a name may be combined.
          </p>
        </section>
      </div>
    </main>
  );
}
