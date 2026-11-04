import type { Metadata } from "next";
import Link from "next/link";
import AwardRow from "@/components/AwardRow";
import CompatibilitySection from "@/components/CompatibilitySection";
import Section from "@/components/Section";
import { CollegeTag } from "@/components/Tags";
import { getDemoProfile } from "@/lib/api";

export const metadata: Metadata = { title: "Demo research profile" };

export default async function DemoProfilePage() {
  const profile = await getDemoProfile();
  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-8">
      <nav aria-label="Breadcrumb" className="text-small text-ink-3">
        <Link href="/" className="hover:text-ink">ResearchConnect</Link>
        {" "}<span aria-hidden="true">/</span>{" "}
        <span className="text-ink-2">Demo profile</span>
      </nav>

      <header className="grid lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
        <div className="flex gap-5 items-start">
          <div className="w-20 h-20 rounded-full bg-cherry-tint text-cherry font-serif text-h2 flex items-center justify-center shrink-0" aria-hidden="true">
            {profile.initials}
          </div>
          <div>
            <p className="text-tiny font-semibold uppercase tracking-wider text-cherry mb-2">Synthetic demo profile</p>
            <h1 className="text-h1">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-small text-ink-2">
              <CollegeTag id={profile.college} short={false} />
              <span>{profile.department}</span>
            </div>
            <p className="text-lead text-ink-2 mt-4">{profile.bio}</p>
          </div>
        </div>
        <div className="bg-cherry-tint border border-cherry/20 rounded-xl p-4 text-small text-ink-2">
          <strong className="text-ink">For the demo:</strong> this profile represents a researcher who has not
          claimed an account. Its interests are synthetic; the compatible records below come from the live database.
        </div>
      </header>

      <Section title="Research interests" subtitle="Synthetic preferences used only to demonstrate matching.">
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <Link key={interest.id} href={`/topics/${interest.id}`} className="px-3 py-1.5 rounded-full bg-surface border border-line text-small hover:border-cherry">
              {interest.name}
            </Link>
          ))}
        </div>
      </Section>

      <CompatibilitySection compatibility={profile.compatibility} />
    </main>
  );
}
