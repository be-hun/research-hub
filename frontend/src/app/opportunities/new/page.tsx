import PostOpportunityForm from "@/components/PostOpportunityForm";
import { getProjects } from "@/lib/api";

export default async function NewOpportunityPage() {
  // TODO: scope to the signed-in faculty member's projects once auth exists.
  const projects = await getProjects(["p-006", "p-002", "p-001"]);

  return (
    <main className="max-w-[1100px] mx-auto px-margin py-8">
      <h1 className="font-headline text-headline-lg">Post a Student Opportunity</h1>
      <p className="text-body-md text-tertiary mt-1 mb-space-lg">
        Create a research assistantship, fellowship, or credit-bearing opening. Published openings are matched with
        qualified students.
      </p>
      <PostOpportunityForm projects={projects.map((p) => ({ id: p.id, title: p.title, colleges: p.colleges }))} />
    </main>
  );
}
