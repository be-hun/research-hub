"use client";

import Link from "next/link";
import { toggleSaved, useSaved } from "@/lib/demoStore";
import Icon from "./Icon";

/**
 * Records and researchers the demo account bookmarked, newest first. `compact` drops the card frame and tightens the
 * rows, for use inside a card that already has one (the account page).
 */
export default function SavedList({ compact = false }: { compact?: boolean }) {
  const saved = useSaved();
  if (saved.length === 0) {
    return (
      <div className={compact ? "text-small text-ink-2" : "bg-surface border border-line rounded-xl p-5 text-small text-ink-2"}>
        Nothing saved yet. Use <strong className="text-ink">Save</strong> on any award, trial, paper or researcher page.
      </div>
    );
  }
  return (
    <ul className={compact ? "divide-y divide-line -my-2" : "bg-surface border border-line rounded-xl divide-y divide-line"}>
      {saved.map((item) => (
        <li key={`${item.kind}:${item.id}`} className={`flex items-start gap-3 ${compact ? "py-2.5" : "px-4 py-3"}`}>
          <Icon name={item.kind === "researcher" ? "person" : "description"} size={20} className="text-ink-3 mt-0.5" />
          <div className="min-w-0 flex-1">
            <Link
              href={item.kind === "researcher" ? `/researchers/${item.id}` : `/projects/${item.id}`}
              className={`${compact ? "text-small line-clamp-2" : "text-body"} font-medium break-words hover:text-cherry hover:underline underline-offset-2`}
            >
              {item.title}
            </Link>
            {item.detail && <p className="text-tiny text-ink-3 mt-0.5">{item.detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => toggleSaved(item)}
            className="text-tiny text-ink-3 hover:text-cherry shrink-0 mt-1"
            aria-label={`Remove ${item.title} from saved`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
