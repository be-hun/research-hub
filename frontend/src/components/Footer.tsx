import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface mt-20">
      <div className="max-w-page mx-auto px-4 sm:px-6 py-10 grid gap-6 md:grid-cols-[1fr_auto] text-small text-ink-3">
        <div className="space-y-2 max-w-2xl">
          <p>
            Student prototype for the Temple AI Build Challenge, built from public records. Not an official Temple site.
            Photos are AI-generated.{" "}
            <Link href="/about#limits" className="text-cherry underline underline-offset-2">
              Data limits
            </Link>
          </p>
        </div>
        <nav aria-label="Footer" className="flex md:flex-col gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-ink">About the data</Link>
          <Link href="/about#responsible-ai" className="hover:text-ink">Responsible AI</Link>
        </nav>
      </div>
    </footer>
  );
}
