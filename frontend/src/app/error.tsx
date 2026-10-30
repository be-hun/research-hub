"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 text-center">
      <h1 className="text-h1">We couldn&apos;t load this page</h1>
      <p className="text-lead text-ink-2 mt-3">
        The research database didn&apos;t respond. It may be starting up. Try again in a moment.
      </p>
      <div className="flex justify-center gap-3 mt-8">
        <button onClick={reset} className="px-4 py-2 rounded-lg bg-cherry text-white font-medium hover:bg-cherry-dark">
          Try again
        </button>
        <Link href="/about" className="px-4 py-2 rounded-lg border border-line-strong bg-surface hover:border-ink-3">
          About the data
        </Link>
      </div>
    </main>
  );
}
