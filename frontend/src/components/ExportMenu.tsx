"use client";

import { useEffect, useRef, useState } from "react";
import {
  type ExportMessage,
  exportFilename,
  exportTitle,
  toJson,
  toMarkdown,
  toPlainText,
} from "@/lib/exportChat";
import Icon from "./Icon";

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ITEM = "w-full flex items-center gap-2 px-3 py-2 text-left text-small text-ink hover:bg-canvas focus-visible:bg-canvas";

/** Export the conversation on screen, saved or not: Markdown, JSON, the clipboard, or the print dialog. */
export default function ExportMenu({
  messages,
  title,
  conversationId,
}: {
  messages: ExportMessage[];
  title?: string | null;
  conversationId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = exportTitle(messages, title);
  const origin = () => window.location.origin;

  function run(action: () => void | Promise<void>) {
    setOpen(false);
    void action();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(messages, name, origin()));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard is blocked; the downloads still work.
    }
  }

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={messages.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line-strong bg-surface text-small font-medium text-ink-2 hover:border-cherry hover:text-cherry disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink-2"
      >
        <Icon name={copied ? "check" : "download"} size={18} />
        <span aria-live="polite">{copied ? "Copied" : "Export"}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-lg shadow-card py-1 z-30"
        >
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() =>
              run(() => download(toMarkdown(messages, name, origin()), exportFilename(name, "md"), "text/markdown;charset=utf-8"))
            }
          >
            <Icon name="description" size={18} />
            Markdown (.md)
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() =>
              run(() =>
                download(
                  toJson(messages, name, origin(), conversationId ?? null),
                  exportFilename(name, "json"),
                  "application/json;charset=utf-8",
                ),
              )
            }
          >
            <Icon name="data_object" size={18} />
            JSON (.json)
          </button>
          <button type="button" role="menuitem" className={ITEM} onClick={() => run(copy)}>
            <Icon name="content_copy" size={18} />
            Copy as text
          </button>
          <button type="button" role="menuitem" className={ITEM} onClick={() => run(() => window.print())}>
            <Icon name="print" size={18} />
            Print / Save as PDF
          </button>
        </div>
      )}
    </div>
  );
}
