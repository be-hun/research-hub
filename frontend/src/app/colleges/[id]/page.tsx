import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AISummary from "@/components/AISummary";
import CollegeDashboard from "@/components/CollegeDashboard";
import CollegeHeader from "@/components/CollegeHeader";
import { getCollege } from "@/lib/api";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const d = await getCollege(params.id);
  return { title: d?.college.name ?? "College" };
}

export default async function CollegePage({ params }: { params: { id: string } }) {
  const d = await getCollege(params.id);
  if (!d) notFound();

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-12">
      <nav aria-label="Breadcrumb" className="text-small text-ink-3">
        <Link href="/colleges" className="hover:text-ink">Colleges</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-ink-2">{d.college.name}</span>
      </nav>
      <CollegeHeader d={d} />
      <AISummary kind="college" id={d.college.id} about={`research at ${d.college.name}`} />
      <CollegeDashboard d={d} />
    </main>
  );
}
