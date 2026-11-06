"use client";

import Link from "next/link";
import { searchQueryString, type SearchParams } from "@/lib/api";
import { KIND_LABELS } from "@/lib/colleges";
import { type SavedItem, toggleSaved, useSaved } from "@/lib/demoStore";
import type { AssistantReply, CollegeId } from "@/lib/types";
import Icon from "./Icon";
import ShareButton from "./ShareButton";

// The words the assistant reads as a college (backend/app/assistant.py, COLLEGE_WORDS). The reply doesn't say which
// filters it used, so the search link works them out from the question, the "Searched:" line and the cited records.
const COLLEGE_WORDS: [string, CollegeId][] = [
  ["engineering", "engineering"],
  ["medicine", "medicine"],
  ["public health", "public-health"],
  ["business", "business"],
  ["fox", "business"],
  ["klein", "media"],
  ["liberal arts", "liberal-arts"],
  ["education", "education"],
  ["science", "science-tech"],
  ["technology", "science-tech"],
];
// What the "Searched:" line says when there were no search words.
const NO_QUERY = new Set(["your interests", "the requested filters"]);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The /search URL that shows the records behind an answer, with the same filters the assistant applied. */
export function answerSearchHref(reply: AssistantReply, question: string): string {
  // searchedFor reads "<label> · <search words>[ · excluding <college>]".
  const [label = "", detail = ""] = reply.searchedFor.split(" · ");
  const params: SearchParams = { q: NO_QUERY.has(detail) ? "" : detail.trim() };
  if (label.startsWith("Recruiting")) {
    params.kinds = ["trial"];
    params.status = ["recruiting"];
  } else if (reply.mode === "research" && reply.records.length) {
    // Every cited record is one kind: the question asked for that kind ("grants", "papers", "trials").
    const kinds = Array.from(new Set(reply.records.map((r) => r.project.kind)));
    if (kinds.length === 1) params.kinds = kinds;
  }
  const lower = question.toLowerCase();
  const excluded = /\b(?:outside|beyond|other than)\b/.test(lower);
  const named = COLLEGE_WORDS.find(([word]) => new RegExp(`\\b${escape(word)}\\b`).test(lower));
  if (named && !excluded) params.colleges = [named[1]];
  return `/search?${searchQueryString(params)}`;
}

function savedItems(reply: AssistantReply): SavedItem[] {
  if (reply.mode === "people") {
    return reply.people.flatMap((p) =>
      p.researcherId ? [{ kind: "researcher" as const, id: p.researcherId, title: p.name, detail: p.department || undefined }] : [],
    );
  }
  return reply.records.map(({ project: p }) => ({
    kind: "record" as const,
    id: p.id,
    title: p.title,
    detail: [KIND_LABELS[p.kind], p.statusLabel].filter(Boolean).join(" · "),
  }));
}

const ACTION =
  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-tiny font-medium text-ink-2 hover:text-cherry hover:bg-cherry-tint";

/** Save every cited record (or researcher) to the demo account at once; a second click removes them again. */
function SaveAll({ items }: { items: SavedItem[] }) {
  const saved = useSaved();
  const isSaved = (item: SavedItem) => saved.some((s) => s.kind === item.kind && s.id === item.id);
  const all = items.every(isSaved);
  return (
    <button
      type="button"
      onClick={() => items.filter((item) => isSaved(item) === all).forEach(toggleSaved)}
      aria-pressed={all}
      className={all ? `${ACTION} bg-cherry-tint text-cherry` : ACTION}
    >
      <Icon name={all ? "bookmark_added" : "bookmark"} size={16} />
      {all ? `Saved all ${items.length}` : `Save all ${items.length}`}
    </button>
  );
}

/** The row under an answer: open it as a search, save what it cites, share the question. */
export default function AnswerActions({
  reply,
  question,
  signedIn,
}: {
  reply: AssistantReply;
  question: string;
  signedIn: boolean;
}) {
  const items = savedItems(reply);
  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-line pt-2">
      <Link href={answerSearchHref(reply, question)} className={ACTION}>
        <Icon name="search" size={16} />
        Open in Search
      </Link>
      {signedIn && items.length > 0 && <SaveAll items={items} />}
      <ShareButton path={`/ask?q=${encodeURIComponent(question)}`} title={question} />
    </div>
  );
}
