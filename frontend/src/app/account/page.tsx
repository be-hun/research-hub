import type { Metadata } from "next";
import { Suspense } from "react";
import SavedList from "@/components/SavedList";
import DiscoveryNote from "@/components/profile/DiscoveryNote";
import { EditInterestsProvider } from "@/components/profile/EditInterests";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileHeader from "@/components/profile/ProfileHeader";
import SignedOutPreview from "@/components/profile/SignedOutPreview";
import { CardSkeleton, LineSkeleton, SideSkeleton } from "@/components/profile/Skeletons";
import { getDemoProfile, getForYou, getForYouPeople, getTopics } from "@/lib/api";
import { demoProfileInput } from "@/lib/demo";
import { CollegesSection, FeedSection, HeaderStats, InterestsSection, PeopleSection, TopicsSection } from "./sections";

export const metadata: Metadata = { title: "My account" };

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Mark a request's failure as handled now; the section that awaits it still sees the error. */
function started<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return p;
}

export default async function AccountPage() {
  const input = demoProfileInput();
  if (!input) return <SignedOutPreview profile={await getDemoProfile()} />;

  // Every request starts here, together. The header waits only for the profile; each section below waits, inside
  // its own <Suspense>, for the requests it needs.
  const topics = started(getTopics());
  const forYou = started(getForYou(input));
  // Page 1 of the full people ranking feeds the college chart. If it fails, the chart counts the top six instead.
  const people = getForYouPeople(input, 1).catch(() => null);
  const profile = await getDemoProfile();
  const edited = !sameList(input.topics, profile.interests.map((t) => t.id)) || !sameList(input.terms, profile.terms);

  return (
    <EditInterestsProvider>
      <main className="max-w-page mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        <ProfileHeader
          profile={profile}
          stats={
            <Suspense fallback={<LineSkeleton className="w-72" />}>
              <HeaderStats forYou={forYou} topics={topics} input={input} />
            </Suspense>
          }
        />

        {/* Desktop: a main column and a sidebar. Phones: one column, the sidebar after "New for you", then Saved. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div className="space-y-6 min-w-0 lg:col-start-1 lg:row-start-1">
            <ProfileCard id="about" title="About">
              <div className="space-y-2 text-body text-ink-2">
                <p>{profile.bio}</p>
                <p>
                  Maya is not a real person and her interests are made up. The research matched to her below is real,
                  from public records.
                </p>
              </div>
            </ProfileCard>

            <Suspense fallback={<CardSkeleton title="Research interests" rows={1} />}>
              <InterestsSection topics={topics} input={input} edited={edited} />
            </Suspense>

            <Suspense fallback={<CardSkeleton title="New for you" rows={3} tall />}>
              <FeedSection forYou={forYou} />
            </Suspense>
          </div>

          <aside className="space-y-6 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2" aria-label="Your matches at a glance">
            <Suspense fallback={<SideSkeleton title="People to connect with" rows={6} />}>
              <PeopleSection forYou={forYou} />
            </Suspense>
            <Suspense fallback={<SideSkeleton title="Where your matches are" rows={3} />}>
              <CollegesSection forYou={forYou} people={people} />
            </Suspense>
            <Suspense fallback={<SideSkeleton title="Topics you follow" rows={Math.max(1, input.topics.length)} />}>
              <TopicsSection topics={topics} input={input} />
            </Suspense>
            <DiscoveryNote />
          </aside>

          <div className="min-w-0 self-start lg:col-start-1 lg:row-start-2">
            <ProfileCard id="saved" title="Saved" subtitle="Kept in this browser for the demo, and cleared when you sign out.">
              <SavedList compact />
            </ProfileCard>
          </div>
        </div>
      </main>
    </EditInterestsProvider>
  );
}
