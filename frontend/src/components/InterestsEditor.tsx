"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resetInterests, saveInterests } from "@/app/account/actions";
import { type Interests, MAX_TERM_LENGTH, MAX_TERMS, MAX_TOPICS } from "@/lib/profileLimits";
import type { TopicRef } from "@/lib/types";
import Icon from "./Icon";

function Chip({ label, href, onRemove }: { label: string; href?: string; onRemove: () => void }) {
  return (
    <li className="inline-flex items-center rounded-full bg-surface border border-line text-small">
      {href ? (
        <Link href={href} className="pl-3 py-1.5 hover:text-cherry">
          {label}
        </Link>
      ) : (
        <span className="pl-3 py-1.5">{label}</span>
      )}
      <button type="button" onClick={onRemove} className="px-2 py-1.5 text-ink-3 hover:text-cherry" aria-label={`Remove ${label}`}>
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}

/**
 * Maya's topics and terms. Each change is saved to the demo cookie by a server action, which re-renders the page,
 * so the matches below update straight away.
 */
export default function InterestsEditor({
  topics,
  current,
  edited,
}: {
  topics: TopicRef[];
  current: Interests;
  /** True when the interests differ from Maya's starting ones. */
  edited: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState("");
  const names = new Map(topics.map((t) => [t.id, t.name]));
  const chosen = current.topics.filter((id) => names.has(id));
  const available = topics.filter((t) => !chosen.includes(t.id));
  const save = (next: Interests) => startTransition(() => saveInterests(next));

  function addTerm() {
    const value = term.trim();
    if (!value) return;
    save({ topics: chosen, terms: [...current.terms, value] });
    setTerm("");
  }

  return (
    <div className="space-y-5" aria-busy={pending}>
      <div className="space-y-3">
        <h3 className="text-small font-semibold text-ink">Topics</h3>
        <ul className="flex flex-wrap gap-2" aria-label="Your topics">
          {chosen.length === 0 && <li className="text-small text-ink-3">No topics yet.</li>}
          {chosen.map((id) => (
            <Chip key={id} label={names.get(id)!} href={`/topics/${id}`} onRemove={() => save({ ...current, topics: chosen.filter((t) => t !== id) })} />
          ))}
        </ul>
        <label className="flex flex-wrap items-center gap-2 text-small text-ink-2 max-w-full">
          <span>Add a topic</span>
          <select
            value=""
            disabled={pending || chosen.length >= MAX_TOPICS || available.length === 0}
            onChange={(e) => e.target.value && save({ ...current, topics: [...chosen, e.target.value] })}
            className="max-w-full px-3 py-1.5 rounded-md border border-line-strong bg-surface text-small text-ink disabled:opacity-50"
          >
            <option value="">{chosen.length >= MAX_TOPICS ? `Up to ${MAX_TOPICS} topics` : "Choose a topic…"}</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-small font-semibold text-ink">Keywords</h3>
        <ul className="flex flex-wrap gap-2" aria-label="Your keywords">
          {current.terms.length === 0 && <li className="text-small text-ink-3">No keywords yet.</li>}
          {current.terms.map((t) => (
            <Chip key={t} label={t} onRemove={() => save({ ...current, topics: chosen, terms: current.terms.filter((x) => x !== t) })} />
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTerm();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor="new-term" className="text-small text-ink-2">
            Add a keyword
          </label>
          <input
            id="new-term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            maxLength={MAX_TERM_LENGTH}
            disabled={pending || current.terms.length >= MAX_TERMS}
            placeholder={current.terms.length >= MAX_TERMS ? `Up to ${MAX_TERMS} keywords` : "e.g. wearables"}
            className="min-w-0 w-48 px-3 py-1.5 rounded-md border border-line-strong bg-surface text-small disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || !term.trim() || current.terms.length >= MAX_TERMS}
            className="px-3 py-1.5 rounded-md border border-line-strong bg-surface text-small font-medium hover:border-cherry hover:text-cherry disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-small min-h-[21px]">
        {edited && (
          <button type="button" disabled={pending} onClick={() => startTransition(() => resetInterests())} className="text-cherry hover:underline underline-offset-2">
            Reset to Maya&apos;s starting interests
          </button>
        )}
        <span role="status" className="text-ink-3">
          {pending ? "Updating your matches…" : ""}
        </span>
      </div>
    </div>
  );
}
