import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { TopicSummary } from "@/lib/types";

/** The profile's topics with their sizes from /api/topics: what is active in each, not just how big it is. */
export default function TopicsYouFollow({ topics }: { topics: TopicSummary[] }) {
  if (!topics.length) return <p className="text-small text-ink-3">You don&apos;t follow any topics yet.</p>;
  return (
    <ul className="space-y-1 -mx-2">
      {topics.map((t) => (
        <li key={t.id}>
          <Link href={`/topics/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas group">
            {t.image ? (
              <span className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-canvas">
                <Image src={t.image} alt="" fill sizes="40px" className="object-cover" />
              </span>
            ) : (
              <span className="w-10 h-10 rounded-md bg-cherry-tint text-cherry flex items-center justify-center shrink-0" aria-hidden="true">
                <Icon name="science" size={20} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-small font-semibold text-ink leading-snug group-hover:text-cherry break-words">{t.name}</span>
              <span className="block text-tiny text-ink-3 num">
                {t.active.toLocaleString()} active {t.active === 1 ? "grant" : "grants"} · {t.trials.toLocaleString()}{" "}
                {t.trials === 1 ? "trial" : "trials"} · {t.publications.toLocaleString()} {t.publications === 1 ? "paper" : "papers"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
