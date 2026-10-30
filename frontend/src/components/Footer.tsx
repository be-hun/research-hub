import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface mt-20">
      <div className="max-w-page mx-auto px-4 sm:px-6 py-10 grid gap-6 md:grid-cols-[1fr_auto] text-small text-ink-3">
        <div className="space-y-2 max-w-2xl">
          <p className="text-ink-2">
            Grant records show funding history, not whether a study is active or recruiting.{" "}
            <Link href="/about#limits" className="text-cherry underline underline-offset-2">
              What this data can and can&apos;t tell you
            </Link>
          </p>
          <p>
            ResearchConnect is a student prototype built for the Temple AI Build Challenge from public records: NIH
            RePORTER, NSF Award Search, USAspending.gov, ClinicalTrials.gov and OpenAlex. It is not an official Temple
            University site or record. Photos are AI-generated
            illustrations (Google Stitch), not pictures of real Temple people or facilities.
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
