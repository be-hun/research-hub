"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { KIND_LABELS } from "@/lib/colleges";
import type { IntroDraft, IntroDraftRequest, ProfileInput } from "@/lib/types";
import Icon from "./Icon";

// The demo account is Maya; the backend uses a placeholder when no name is sent.
const SENDER = "Maya Patel";
const FAILED = "Couldn't write a draft just now.";

const VARIANTS = {
  compact:
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-line text-tiny font-medium text-ink-2 hover:border-cherry hover:text-cherry",
  outline:
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-line-strong bg-surface text-small font-semibold text-ink-2 hover:border-cherry hover:text-cherry",
};

type State =
  | { status: "loading" }
  | { status: "done"; draft: IntroDraft }
  | { status: "error"; message: string };

/**
 * Demo account only: a button that drafts a short intro email to a researcher from the records the two already share
 * (POST /api/intro-draft). The draft opens in a dialog with the records it cites, Copy and Regenerate.
 */
export default function IntroDraftButton({
  researcherId,
  name,
  profile,
  variant = "compact",
}: {
  researcherId: string;
  name: string;
  profile: ProfileInput;
  variant?: keyof typeof VARIANTS;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState({ status: "loading" });
    setCopied(false);
    try {
      const res = await fetch(`${API_URL}/api/intro-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researcherId, profile, senderName: SENDER } satisfies IntroDraftRequest),
      });
      const body = await res.json().catch(() => ({}));
      setState(
        res.ok && typeof body?.available === "boolean"
          ? { status: "done", draft: body as IntroDraft }
          : { status: "error", message: typeof body?.detail === "string" ? body.detail : FAILED },
      );
    } catch {
      setState({ status: "error", message: FAILED });
    }
  }

  function open() {
    dialogRef.current?.showModal();
    if (state?.status !== "done") generate();
  }

  async function copy(draft: IntroDraft) {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the text is still selectable in the dialog.
    }
  }

  const draft = state?.status === "done" ? state.draft : null;
  const loading = state?.status === "loading";

  return (
    <>
      <button type="button" onClick={open} className={VARIANTS[variant]}>
        <Icon name="mail" size={variant === "outline" ? 18 : 14} />
        Draft an intro
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`intro-${researcherId}`}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="w-[calc(100%-2rem)] max-w-lg max-h-[85vh] p-0 rounded-xl border border-line bg-surface text-ink shadow-card backdrop:bg-ink/40"
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={`intro-${researcherId}`} className="text-h3 break-words">
                Intro to {name}
              </h2>
              <p className="text-tiny text-ink-3 mt-0.5">Drafted by AI from records you share. Check it before sending.</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="p-1.5 -m-1 rounded-lg text-ink-3 hover:text-ink hover:bg-canvas"
              aria-label="Close"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div aria-live="polite" aria-busy={loading}>
            {loading && (
              <div className="space-y-2 animate-pulse" aria-label="Writing a draft">
                <p className="flex items-center gap-2 text-small text-ink-2">
                  <span className="w-2 h-2 rounded-full bg-cherry animate-pulse shrink-0" aria-hidden="true" />
                  Reading your shared records and writing a draft…
                </p>
                <div className="h-4 w-3/5 rounded bg-line" />
                <div className="h-24 rounded bg-line" />
              </div>
            )}
            {state?.status === "error" && (
              <p className="bg-canvas border border-line text-ink-2 rounded-lg p-3 text-small">{state.message}</p>
            )}
            {draft && !draft.available && (
              <p className="bg-canvas border border-line text-ink-2 rounded-lg p-3 text-small">{draft.message}</p>
            )}
            {draft?.available && (
              <div className="space-y-2">
                <p className="text-small break-words">
                  <span className="text-ink-3">Subject: </span>
                  <strong className="font-semibold">{draft.subject}</strong>
                </p>
                <p className="whitespace-pre-wrap break-words text-small bg-canvas border border-line rounded-lg p-3">
                  {draft.body}
                </p>
              </div>
            )}
          </div>

          {draft && draft.citations.length > 0 && (
            <section>
              <h3 className="text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                {draft.available ? "Records it mentions" : "Shared records we looked at"}
              </h3>
              <ul className="space-y-1">
                {draft.citations.map((c) => (
                  <li key={c.id} className="flex items-baseline gap-2 text-tiny min-w-0">
                    <span className="text-ink-3 shrink-0">{KIND_LABELS[c.kind]}</span>
                    <Link
                      href={`/projects/${c.id}`}
                      className="text-ink-2 hover:text-cherry underline underline-offset-2 break-words min-w-0"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            {draft?.available && (
              <button
                type="button"
                onClick={() => copy(draft)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cherry hover:bg-cherry-dark text-white text-small font-medium"
              >
                <Icon name={copied ? "check" : "content_copy"} size={16} />
                <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
            {/* With no shared records the model isn't called, so a new try would say the same. */}
            {(state?.status === "error" || (draft && (draft.available || draft.citations.length > 0))) && (
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong bg-surface text-small font-medium text-ink-2 hover:border-cherry hover:text-cherry disabled:opacity-40"
              >
                <Icon name="refresh" size={16} />
                {state?.status === "error" ? "Try again" : "Regenerate"}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
