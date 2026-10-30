import Icon from "@/components/Icon";
import ProjectCard from "@/components/ProjectCard";
import SearchBar from "@/components/SearchBar";
import { searchProjects } from "@/lib/api";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const data = await searchProjects({ q, page: Number(searchParams.page) || 1 });

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-8 space-y-4">
      <div className="max-w-4xl mx-auto space-y-3">
        <SearchBar defaultValue={q} placeholder="Search projects, faculty expertise, grant topics, or natural queries..." />
        <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg px-3.5 py-2 flex items-center gap-2 text-[#2F4FD1] text-body-sm">
          <Icon name="psychology" size={18} />
          <span>
            <strong className="font-semibold">Interpreted as:</strong> {data.interpretedAs}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        <div className="pb-3 border-b border-[#E2E8F0]">
          <h1 className="font-headline text-headline-md font-bold">
            Showing {data.total} Projects for <span className="text-primary">&ldquo;{data.query}&rdquo;</span>
          </h1>
        </div>

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 flex items-start gap-3 text-body-sm text-[#92400E]">
          <Icon name="warning" size={20} className="text-[#B45309] shrink-0 mt-0.5" />
          <p>
            <strong className="font-semibold">Award Notice:</strong> Award records show funding history, not that a study
            is currently active or recruiting. Check primary grant disclosures or contact researchers directly.
          </p>
        </div>

        <div className="space-y-4">
          {data.results.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>
    </main>
  );
}
