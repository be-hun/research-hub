import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-surface-container-low border-t border-surface-container-highest mt-12">
      <div className="px-margin py-space-xl mx-auto max-w-[1440px] flex flex-col gap-space-md text-body-sm text-tertiary">
        <p>
          Temple ResearchConnect AI is an experimental exploratory prototype for discovery across schools. Not an
          official university record of faculty employment or compliance.
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-label-md text-on-surface-variant">
          <Link href="/responsible-ai" className="hover:text-primary underline">
            Responsible AI and data use
          </Link>
        </nav>
        <p className="text-xs">© 2025 Temple University. Office of the Vice President for Research.</p>
      </div>
    </footer>
  );
}
