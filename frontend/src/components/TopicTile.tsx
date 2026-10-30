import Image from "next/image";
import Link from "next/link";
import type { TopicSummary } from "@/lib/types";
import Icon from "./Icon";

export default function TopicTile({ topic }: { topic: TopicSummary }) {
  return (
    <Link
      href={`/topics/${topic.id}`}
      className="group block bg-surface border border-line rounded-xl overflow-hidden hover:border-line-strong hover:shadow-card transition-shadow"
    >
      <div className="relative h-28 bg-canvas">
        {topic.image ? (
          <Image src={topic.image} alt="" fill sizes="(min-width: 1024px) 300px, 50vw" className="object-cover" />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-cherry-tint to-canvas flex items-center justify-center text-cherry/60"
            aria-hidden="true"
          >
            <Icon name="science" size={40} />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-sans text-body font-semibold group-hover:text-cherry">{topic.name}</h3>
        <p className="text-small text-ink-3 num mt-0.5">
          {topic.active} active · {topic.awards} total
        </p>
      </div>
    </Link>
  );
}
