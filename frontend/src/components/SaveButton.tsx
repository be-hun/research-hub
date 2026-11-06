"use client";

import { type SavedItem, toggleSaved, useSaved } from "@/lib/demoStore";
import Icon from "./Icon";

/** Bookmark a record or researcher to the demo account. Shown only when signed in. */
export default function SaveButton({ item, compact = false }: { item: SavedItem; compact?: boolean }) {
  const saved = useSaved();
  const on = saved.some((s) => s.kind === item.kind && s.id === item.id);
  return (
    <button
      type="button"
      onClick={() => toggleSaved(item)}
      aria-pressed={on}
      aria-label={compact ? `${on ? "Saved" : "Save"}: ${item.title}` : undefined}
      className={
        compact
          ? `inline-flex items-center gap-1 px-2 py-1 rounded-md text-tiny font-medium shrink-0 ${
              on ? "bg-cherry-tint text-cherry" : "text-ink-2 hover:text-cherry hover:bg-cherry-tint"
            }`
          : `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-small font-medium shrink-0 ${
              on ? "border-cherry bg-cherry-tint text-cherry" : "border-line-strong bg-surface text-ink-2 hover:border-cherry hover:text-cherry"
            }`
      }
    >
      <Icon name={on ? "bookmark_added" : "bookmark"} size={compact ? 16 : 18} />
      {on ? "Saved" : "Save"}
    </button>
  );
}
