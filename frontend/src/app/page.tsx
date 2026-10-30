import Link from "next/link";
import Icon from "@/components/Icon";
import ProjectCard from "@/components/ProjectCard";
import SearchBar from "@/components/SearchBar";
import { getFeaturedProjects } from "@/lib/api";

const EXAMPLE_QUERIES = [
  "Find research involving AI and healthcare",
  "Who works on multilingual learning?",
  "Biomedical sensors and patient monitoring",
];

export default async function HomePage() {
  const featured = await getFeaturedProjects();

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-space-xl flex flex-col gap-space-xl">
      <section className="flex flex-col items-center text-center max-w-4xl mx-auto w-full pt-4">
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#EEF2FF] border border-[#C7D2FE] text-[#2F4FD1] text-label-md mb-space-md">
          <Icon name="auto_awesome" size={16} />
          <span>Cross-Disciplinary AI Discovery Index</span>
        </div>
        <h1 className="font-headline text-headline-xl tracking-tight mb-space-xs">
          Find the research happening across Temple
        </h1>
        <p className="text-body-lg text-tertiary max-w-2xl mb-space-lg">
          Search projects, people and opportunities beyond your own college
        </p>
        <SearchBar placeholder="Describe a research question, methodology, or interdisciplinary topic in plain English..." />
        <div className="mt-space-md flex flex-wrap items-center justify-center gap-2">
          <span className="text-label-md text-tertiary mr-1">Try querying:</span>
          {EXAMPLE_QUERIES.map((q) => (
            <Link
              key={q}
              href={`/search?q=${encodeURIComponent(q)}`}
              className="bg-surface-container-lowest border border-[#E2E8F0] hover:border-slate-400 text-slate-700 px-3 py-1.5 rounded-full text-label-md"
            >
              {q}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-space-md">
          <h2 className="font-headline text-headline-lg">Featured cross-college projects</h2>
          <p className="text-body-md text-tertiary">Verified collaborations bridging disciplines</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
          {featured.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>

      <section className="p-3 rounded bg-amber-50 border border-amber-200 flex items-center gap-space-sm text-amber-900 text-body-sm">
        <Icon name="warning" size={18} className="text-amber-700 shrink-0" />
        <span>
          <strong>Provenance note:</strong> Award records show funding, not that a study is currently active. Check the
          primary grant or contact researchers directly for current status.
        </span>
      </section>
    </main>
  );
}
