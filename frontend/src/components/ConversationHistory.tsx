"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@/lib/types";
import { groupByDate } from "@/lib/conversations";
import Icon from "./Icon";

export type HistoryState = "loading" | "ready" | "error";

const ICON_BUTTON = "p-1.5 rounded-md text-ink-3 hover:text-cherry hover:bg-cherry-tint focus-visible:text-cherry";

function Item({
  item,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  item: ConversationSummary;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [draft, setDraft] = useState(item.title);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saving = useRef(false); // Enter submits, then the blur would save a second time

  useEffect(() => {
    if (mode === "rename") inputRef.current?.select();
  }, [mode]);

  async function save() {
    if (saving.current) return;
    const title = draft.trim();
    if (!title || title === item.title) {
      setMode("view");
      setDraft(item.title);
      return;
    }
    saving.current = true;
    setPending(true);
    const ok = await onRename(item.id, title);
    saving.current = false;
    setPending(false);
    setFailed(!ok);
    if (ok) setMode("view");
  }

  async function remove() {
    setPending(true);
    const ok = await onDelete(item.id);
    setPending(false);
    setFailed(!ok);
    if (!ok) setMode("view");
  }

  if (mode === "rename") {
    return (
      <li className="px-1 py-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor={`rename-${item.id}`} className="sr-only">
            Rename chat
          </label>
          <input
            id={`rename-${item.id}`}
            ref={inputRef}
            value={draft}
            maxLength={120}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft(item.title);
                setMode("view");
              }
            }}
            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-cherry bg-surface text-small focus:outline-none"
          />
        </form>
        {failed && <p className="text-tiny text-ink-3 px-1 mt-1">Couldn&apos;t rename it. Try again.</p>}
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="px-2 py-2 rounded-lg bg-canvas border border-line">
        <p className="text-small text-ink">Delete &quot;{item.title}&quot;?</p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="px-3 py-1 rounded-md bg-cherry hover:bg-cherry-dark text-white text-small font-medium disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={pending}
            className="px-3 py-1 rounded-md border border-line-strong bg-surface text-small text-ink-2 hover:border-cherry"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`group flex items-center gap-1 rounded-lg ${active ? "bg-cherry-tint" : "hover:bg-canvas"}`}
    >
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={active ? "true" : undefined}
        className={`flex-1 min-w-0 text-left px-2.5 py-2 text-small truncate rounded-lg ${
          active ? "text-cherry-dark font-semibold" : "text-ink-2 hover:text-ink"
        }`}
        title={item.title}
      >
        {item.title || "Untitled chat"}
      </button>
      <div className="flex shrink-0 pr-1 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => {
            setDraft(item.title);
            setFailed(false);
            setMode("rename");
          }}
          className={ICON_BUTTON}
          aria-label={`Rename ${item.title}`}
        >
          <Icon name="edit" size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setMode("confirm");
          }}
          className={ICON_BUTTON}
          aria-label={`Delete ${item.title}`}
        >
          <Icon name="delete" size={16} />
        </button>
      </div>
      {failed && <span className="sr-only">Couldn&apos;t delete it.</span>}
    </li>
  );
}

/** The saved chats: New chat, then Today / Previous 7 days / Older. Errors stay quiet; Ask works without history. */
export default function ConversationHistory({
  items,
  state,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onRetry,
}: {
  items: ConversationSummary[];
  state: HistoryState;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRetry: () => void;
}) {
  const groups = groupByDate(items);
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-cherry hover:bg-cherry-dark text-white text-small font-semibold"
      >
        <Icon name="add" size={18} />
        New chat
      </button>
      {state === "loading" && items.length === 0 && (
        <ul className="space-y-2 animate-pulse" aria-label="Loading chats">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-8 rounded-lg bg-line/70" />
          ))}
        </ul>
      )}
      {state === "error" && items.length === 0 && (
        <p className="text-tiny text-ink-3">
          Saved chats aren&apos;t available right now. You can still ask questions.{" "}
          <button type="button" onClick={onRetry} className="text-cherry underline underline-offset-2">
            Retry
          </button>
        </p>
      )}
      {state === "ready" && items.length === 0 && (
        <p className="text-tiny text-ink-3">No saved chats yet. Your questions and answers are kept here.</p>
      )}
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h2 className="font-sans text-tiny font-semibold uppercase tracking-wider text-ink-3 px-2.5 mb-1">{g.label}</h2>
          <ul className="space-y-0.5">
            {g.items.map((c) => (
              <Item
                key={c.id}
                item={c}
                active={c.id === activeId}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
