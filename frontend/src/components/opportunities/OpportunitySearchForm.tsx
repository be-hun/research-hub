import Icon from "@/components/Icon";
import type { OpportunityParams } from "@/lib/api";

/** The /opportunities search box. A new query keeps the chosen filters and sort (hidden fields) and starts at page 1. */
export default function OpportunitySearchForm({ params }: { params: OpportunityParams }) {
  return (
    <form action="/opportunities" role="search" className="w-full">
      <label className="sr-only" htmlFor="opportunity-q">
        Search federal funding calls
      </label>
      <div className="flex items-center gap-2 bg-surface border border-line-strong rounded-xl shadow-card focus-within:border-cherry p-1.5">
        <Icon name="search" size={20} className="text-ink-3 ml-3" />
        <input
          id="opportunity-q"
          name="q"
          defaultValue={params.q}
          placeholder="Search funding calls"
          className="w-full min-w-0 bg-transparent border-0 focus:outline-none placeholder:text-ink-3 text-body py-1.5"
        />
        <button type="submit" className="bg-cherry hover:bg-cherry-dark text-white rounded-lg font-medium shrink-0 px-4 py-2 text-small">
          Search
        </button>
      </div>
      {params.agencies?.map((a) => <input key={`a-${a}`} type="hidden" name="agency" value={a} />)}
      {params.status?.map((s) => <input key={`s-${s}`} type="hidden" name="status" value={s} />)}
      {params.categories?.map((c) => <input key={`c-${c}`} type="hidden" name="category" value={c} />)}
      {params.universities && <input type="hidden" name="universities" value="true" />}
      {params.closesWithin != null && <input type="hidden" name="closes_within" value={params.closesWithin} />}
      {params.sort && params.sort !== "deadline" && <input type="hidden" name="sort" value={params.sort} />}
    </form>
  );
}
