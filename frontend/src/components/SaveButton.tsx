"use client";

import { type SavedItem, toggleSaved, useDemoState } from "@/lib/demoStore";
import Icon from "./Icon";

/** Bookmark a record or researcher to the demo account. Shown only when signed in. */
export default function SaveButton({ item }: { item: SavedItem }) {
  const { saved } = useDemoState();
  const on = saved.some((s) => s.kind === item.kind && s.id === item.id);
  return (
    <button
      type="button"
      onClick={() => toggleSaved(item)}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-small font-medium shrink-0 ${
        on ? "border-cherry bg-cherry-tint text-cherry" : "border-line-strong bg-surface text-ink-2 hover:border-cherry hover:text-cherry"
      }`}
    >
      <Icon name={on ? "bookmark_added" : "bookmark"} size={18} />
      {on ? "Saved" : "Save"}
    </button>
  );
}
