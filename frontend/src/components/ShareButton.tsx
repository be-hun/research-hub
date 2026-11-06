"use client";

import { useState } from "react";
import Icon from "./Icon";

const VARIANTS = {
  compact: "inline-flex items-center gap-1 px-2 py-1 rounded-md text-tiny font-medium text-ink-2 hover:text-cherry hover:bg-cherry-tint",
  // A full-size button for page headers, e.g. the account page.
  outline:
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-line-strong bg-surface text-small font-semibold text-ink-2 hover:border-cherry hover:text-cherry",
};

/** Share a page on this site: the system share sheet where there is one, otherwise copy the link. */
export default function ShareButton({
  path,
  title,
  variant = "compact",
}: {
  path: string;
  title: string;
  variant?: keyof typeof VARIANTS;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The person closed the share sheet, or the clipboard is blocked. Nothing to undo.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={VARIANTS[variant]}
      aria-label={copied ? "Link copied" : `Share ${title}`}
    >
      <Icon name={copied ? "check" : "share"} size={variant === "outline" ? 18 : 16} />
      <span aria-live="polite">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}
