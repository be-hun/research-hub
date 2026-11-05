import type { Metadata } from "next";
import ForYou from "@/components/ForYou";
import InterestsEditor from "@/components/InterestsEditor";
import SavedList from "@/components/SavedList";
import Section from "@/components/Section";
import SignOutButton from "@/components/SignOutButton";
import { CollegeTag } from "@/components/Tags";
import { getDemoProfile, getForYou, getTopics } from "@/lib/api";
import { demoProfileInput } from "@/lib/demo";
import { signInAsDemo } from "./actions";

export const metadata: Metadata = { title: "My account" };

function SignedOut() {
  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-12">
      <div className="max-w-2xl bg-surface border border-line rounded-xl p-5 sm:p-8 space-y-5">
        <p className="text-tiny font-semibold uppercase tracking-wider text-cherry">Demo account</p>
        <h1 className="text-[30px] leading-[38px] sm:text-h1 break-words">See ResearchConnect as a researcher would</h1>
        <p className="text-lead text-ink-2">
          Sign in as Maya Patel, a synthetic biomedical engineering researcher, to see how the site works for someone
          looking for collaborators and active research.
        </p>
        <ul className="text-body text-ink-2 list-disc pl-5 space-y-1">
          <li>Research interests you can edit</li>
          <li>Recruiting trials, active grants and people that match them, all from public records</li>
          <li>Matches marked in search, on researcher pages and in Ask</li>
          <li>Saved researchers and records</li>
        </ul>
        <form action={signInAsDemo}>
          <button type="submit" className="px-4 py-2.5 rounded-md bg-cherry text-white font-medium hover:bg-cherry-dark">
            Sign in as Maya (demo)
          </button>
        </form>
        <p className="text-tiny text-ink-3">
          No password and no real account. Maya&apos;s changes stay in this browser and are cleared when you sign out.
        </p>
      </div>
    </main>
  );
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export default async function AccountPage() {
  const input = demoProfileInput();
  if (!input) return <SignedOut />;
  const [profile, topics, forYou] = await Promise.all([getDemoProfile(), getTopics(), getForYou(input)]);
  const edited = !sameList(input.topics, profile.interests.map((t) => t.id)) || !sameList(input.terms, profile.terms);

  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-8 space-y-12">
      <header className="grid lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
        <div className="flex gap-5 items-start">
          <div className="w-20 h-20 rounded-full bg-cherry-tint text-cherry font-serif text-h2 flex items-center justify-center shrink-0" aria-hidden="true">
            {profile.initials}
          </div>
          <div className="min-w-0">
            <p className="text-tiny font-semibold uppercase tracking-wider text-cherry mb-2">My account · synthetic demo</p>
            <h1 className="text-h1">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-small text-ink-2">
              <CollegeTag id={profile.college} short={false} />
              <span>{profile.department}</span>
            </div>
            <p className="text-lead text-ink-2 mt-4">{profile.bio}</p>
          </div>
        </div>
        <div className="bg-cherry-tint border border-cherry/20 rounded-xl p-4 text-small text-ink-2 space-y-3">
          <p>
            <strong className="text-ink">You&apos;re signed in to a demo account.</strong> Maya is not a real person and
            her interests are made up. The research matched to her is real, from public records.
          </p>
          <SignOutButton />
        </div>
      </header>

      <Section title="Your research interests" subtitle="Change them and your matches below update.">
        <InterestsEditor topics={topics.map((t) => ({ id: t.id, name: t.name }))} current={input} edited={edited} />
      </Section>

      <Section id="for-you" title="For you" subtitle="Active research and people that share your interests.">
        <ForYou data={forYou} terms={input.terms} college={input.college} />
      </Section>

      <Section title="Saved" subtitle="Kept in this browser for the demo.">
        <SavedList />
      </Section>
    </main>
  );
}
