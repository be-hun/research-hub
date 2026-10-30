import Link from "next/link";
import Icon from "@/components/Icon";
import OpportunityCard from "@/components/OpportunityCard";
import { getOpportunities } from "@/lib/api";

export default async function OpportunitiesPage() {
  const opportunities = await getOpportunities();

  return (
    <main className="max-w-[1440px] mx-auto px-margin py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-space-lg">
        <div>
          <h1 className="font-headline text-headline-lg">Student Research Opportunities</h1>
          <p className="text-body-md text-tertiary">
            Funded lab positions posted by verified Temple faculty. {opportunities.length} active openings.
          </p>
        </div>
        <Link
          href="/opportunities/new"
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded-lg text-label-lg"
        >
          <Icon name="add" size={18} /> Post an opportunity
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        {opportunities.map((o) => (
          <OpportunityCard key={o.id} opp={o} />
        ))}
      </div>
      <p className="mt-space-lg text-body-sm text-tertiary">
        Openings show funding and scope as posted by the PI. Confirm availability with the faculty sponsor before applying.
      </p>
    </main>
  );
}
