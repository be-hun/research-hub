import Link from "next/link";
import { GRANTS_GOV_SEARCH } from "@/lib/opportunities";

export default function OpportunityNotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 text-center">
      <h1 className="text-h1">We couldn&apos;t find that funding call</h1>
      <p className="text-lead text-ink-2 mt-3">
        It may have been archived on Grants.gov or dropped in the latest daily refresh.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        <Link href="/opportunities" className="px-4 py-2 rounded-lg bg-cherry text-white font-medium hover:bg-cherry-dark">
          Browse current calls
        </Link>
        <a
          href={GRANTS_GOV_SEARCH}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-lg border border-line-strong bg-surface hover:border-ink-3"
        >
          Search Grants.gov ↗
        </a>
      </div>
    </main>
  );
}
