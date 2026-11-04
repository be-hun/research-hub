"use client";

import Link from "next/link";
import { MAX_INTERESTS, setTopics, useDemoState } from "@/lib/demoStore";
import type { TopicRef } from "@/lib/types";
import Icon from "./Icon";

/** Maya's research interests as chips she can remove, add and reset. Kept in this browser only. */
export default function InterestsEditor({ topics, starting }: { topics: TopicRef[]; starting: TopicRef[] }) {
  const state = useDemoState();
  const byId = new Map(topics.map((t) => [t.id, t]));
  const startingIds = starting.map((t) => t.id);
  const current = (state.topics ?? startingIds).filter((id) => byId.has(id));
  const edited = state.topics !== null && current.join() !== startingIds.join();
  const available = topics.filter((t) => !current.includes(t.id));
  const full = current.length >= MAX_INTERESTS;

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Your interests">
        {current.length === 0 && <li className="text-small text-ink-3">No interests yet. Add one below.</li>}
        {current.map((id) => (
          <li key={id} className="inline-flex items-center rounded-full bg-surface border border-line text-small">
            <Link href={`/topics/${id}`} className="pl-3 py-1.5 hover:text-cherry">
              {byId.get(id)!.name}
            </Link>
            <button
              type="button"
              onClick={() => setTopics(current.filter((t) => t !== id))}
              className="px-2 py-1.5 text-ink-3 hover:text-cherry"
              aria-label={`Remove ${byId.get(id)!.name}`}
            >
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2 text-small text-ink-2 max-w-full">
          <span>Add an interest</span>
          <select
            value=""
            disabled={full || available.length === 0}
            onChange={(e) => e.target.value && setTopics([...current, e.target.value])}
            className="max-w-full px-3 py-1.5 rounded-md border border-line-strong bg-surface text-small text-ink disabled:opacity-50"
          >
            <option value="">{full ? `Up to ${MAX_INTERESTS} interests` : "Choose a topic…"}</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {edited && (
          <button type="button" onClick={() => setTopics(null)} className="text-small text-cherry hover:underline underline-offset-2">
            Reset to Maya&apos;s starting interests
          </button>
        )}
      </div>
      {edited && (
        <p className="text-tiny text-ink-3">
          Your changes are saved in this browser. The matches below still use Maya&apos;s starting interests until
          personalized matching is connected.
        </p>
      )}
    </div>
  );
}
