import Link from "next/link";
import InterestChips from "@/components/profile/InterestChips";
import MatchColleges from "@/components/profile/MatchColleges";
import NewForYou from "@/components/profile/NewForYou";
import PersonRow from "@/components/profile/PersonRow";
import ProfileCard, { CardFooterLink } from "@/components/profile/ProfileCard";
import TopicsYouFollow from "@/components/profile/TopicsYouFollow";
import { InterestsCard } from "@/components/profile/EditInterests";
import Icon from "@/components/Icon";
import type { Interests } from "@/lib/profileLimits";
import type { ForYou, PeopleMatches, TopicSummary } from "@/lib/types";

// The account page's sections that wait on data. Each is an async server component rendered inside its own
// <Suspense>, awaiting a request the page started, so the header shows at once and nothing waits on anything else.

/** The followed topics, in the order Maya chose them, with their /api/topics counts. */
export function followedTopics(all: TopicSummary[], ids: string[]): TopicSummary[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is TopicSummary => Boolean(t));
}

export async function HeaderStats({ forYou, topics, input }: { forYou: Promise<ForYou>; topics: Promise<TopicSummary[]>; input: Interests }) {
  const [data, all] = await Promise.all([forYou, topics]);
  const followed = followedTopics(all, input.topics).length;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <Link href="/account/people" className="font-semibold text-cherry hover:underline underline-offset-2 num">
        {data.collaboratorTotal.toLocaleString()} {data.collaboratorTotal === 1 ? "researcher shares" : "researchers share"} your interests
      </Link>
      <span aria-hidden="true">·</span>
      <a href="#topics" className="font-semibold text-ink-2 hover:text-cherry hover:underline underline-offset-2 num">
        {followed} {followed === 1 ? "topic" : "topics"} followed
      </a>
    </p>
  );
}

export async function InterestsSection({
  topics,
  input,
  edited,
}: {
  topics: Promise<TopicSummary[]>;
  input: Interests;
  edited: boolean;
}) {
  const all = await topics;
  return (
    <InterestsCard
      view={<InterestChips topics={followedTopics(all, input.topics)} terms={input.terms} />}
      topics={all.map((t) => ({ id: t.id, name: t.name }))}
      current={input}
      edited={edited}
    />
  );
}

export async function FeedSection({ forYou }: { forYou: Promise<ForYou> }) {
  const data = await forYou;
  return (
    <ProfileCard
      id="for-you"
      title="New for you"
      subtitle="Recruiting clinical trials and active grants that share your interests, best match first."
    >
      <NewForYou data={data} />
    </ProfileCard>
  );
}

export async function PeopleSection({ forYou }: { forYou: Promise<ForYou> }) {
  const data = await forYou;
  const total = data.collaboratorTotal;
  return (
    <ProfileCard
      id="people"
      size="sm"
      title="People to connect with"
      subtitle="Researchers with active or recent work that shares your interests."
      footer={
        total > 0 && (
          <CardFooterLink href="/account/people">
            See all {total.toLocaleString()} <Icon name="arrow_forward" size={18} />
          </CardFooterLink>
        )
      }
    >
      {data.collaborators.length ? (
        <ul className="divide-y divide-line -my-3">
          {data.collaborators.map((p) => (
            <PersonRow key={p.researcherId} person={p} total={total} />
          ))}
        </ul>
      ) : (
        <p className="text-small text-ink-3">No researchers share your interests yet. Add a topic or keyword to widen the search.</p>
      )}
    </ProfileCard>
  );
}

export async function CollegesSection({
  forYou,
  people,
}: {
  forYou: Promise<ForYou>;
  people: Promise<PeopleMatches | null>;
}) {
  const [data, page] = await Promise.all([forYou, people]);
  return (
    <ProfileCard id="colleges" size="sm" title="Where your matches are" subtitle="Among your top matches">
      <MatchColleges people={page?.results ?? data.collaborators} records={[...data.trials, ...data.grants]} />
    </ProfileCard>
  );
}

export async function TopicsSection({ topics, input }: { topics: Promise<TopicSummary[]>; input: Interests }) {
  const all = await topics;
  return (
    <ProfileCard id="topics" size="sm" title="Topics you follow" subtitle="Records at Temple in each topic.">
      <TopicsYouFollow topics={followedTopics(all, input.topics)} />
    </ProfileCard>
  );
}
