import type { Metadata } from "next";
import TopicTile from "@/components/TopicTile";
import { getTopics } from "@/lib/api";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage() {
  const topics = await getTopics();
  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10">
      <header className="max-w-3xl mb-8">
        <h1 className="text-h1">Research topics</h1>
        <p className="text-lead text-ink-2 mt-2">
          Temple&apos;s grants, trials and papers, grouped by subject.
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {topics.map((t) => (
          <TopicTile key={t.id} topic={t} />
        ))}
      </div>
    </main>
  );
}
