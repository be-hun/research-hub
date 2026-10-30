import Link from "next/link";
import SearchBar from "@/components/SearchBar";

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 text-center">
      <h1 className="text-h1">We couldn&apos;t find that page</h1>
      <p className="text-lead text-ink-2 mt-3 mb-8">The award or topic may have been removed in the latest data import.</p>
      <SearchBar />
      <Link href="/explore" className="inline-block mt-6 text-cherry underline underline-offset-2">
        Explore the data instead
      </Link>
    </main>
  );
}
