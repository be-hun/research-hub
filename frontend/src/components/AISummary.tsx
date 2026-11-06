"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import type { AISummary as Summary, SummaryCitation, SummaryKind } from "@/lib/types";
import Icon from "./Icon";

/** "[2]" in the text becomes a numbered link to that record; everything else is plain text. */
function Cited({ text, citations }: { text: string; citations: SummaryCitation[] }) {
  const byN = new Map(citations.map((c) => [c.n, c]));
  return (
    <>
      {text.split(/(\[\d+\])/).map((part, i) => {
        const n = /^\[(\d+)\]$/.exec(part)?.[1];
        const c = n ? byN.get(Number(n)) : undefined;
        if (!c) return <Fragment key={i}>{part}</Fragment>;
        return (
          <sup key={i} className="ml-0.5">
            <Link href={`/projects/${c.id}`} title={c.title} className="num text-cherry font-semibold hover:underline">
              {c.n}
            </Link>
          </sup>
        );
      })}
    </>
  );
}

/**
 * A short model-written summary of the stored records behind a page, from GET /api/summaries/:kind/:id. The backend
 * picks the records with SQL and keeps only citations that point at them; this card always says it is AI-written
 * and links every claim to its record. Loads after the page, so a slow model never delays it.
 */
export default function AISummary({ kind, id, about }: { kind: SummaryKind; id: string; about: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    fetch(`${API_URL}/api/summaries/${kind}/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: Summary) => live && setData(body))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [kind, id]);

  // Nothing to summarize, or the API is unreachable: the page stands on its own without the card.
  if (failed || (data && data.recordCount === 0)) return null;

  return (
    <aside aria-label={`AI summary of ${about}`} aria-busy={!data} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="auto_awesome" size={18} className="text-cherry" />
        <h2 className="font-sans text-body font-semibold">AI summary</h2>
        <span className="text-small text-ink-3">of {about}</span>
      </div>

      {!data ? (
        <div className="space-y-2" role="status">
          <span className="sr-only">Writing a summary of the stored records…</span>
          <div className="h-3.5 rounded bg-canvas animate-pulse w-full" />
          <div className="h-3.5 rounded bg-canvas animate-pulse w-11/12" />
          <div className="h-3.5 rounded bg-canvas animate-pulse w-2/3" />
        </div>
      ) : !data.available ? (
        <p className="text-small text-ink-3">A summary isn’t available right now. {data.message}</p>
      ) : (
        <>
          <p className="text-body text-ink-2 leading-relaxed">
            <Cited text={data.summary} citations={data.citations} />
          </p>
          {data.points.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {data.points.map((p) => (
                <li key={p.text} className="flex gap-2 text-small text-ink-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-cherry shrink-0" aria-hidden="true" />
                  <span>
                    {p.text}
                    <Cited text={p.citations.map((n) => `[${n}]`).join("")} citations={data.citations} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 text-small text-ink-3">
            <summary className="cursor-pointer hover:text-ink-2">
              Written by an AI model from {data.recordCount} stored public {data.recordCount === 1 ? "record" : "records"}.
              It can be wrong; check the cited records.
            </summary>
            <ol className="mt-2 space-y-1">
              {data.citations.map((c) => (
                <li key={c.n} className="flex gap-2">
                  <span className="num text-ink-3 w-5 shrink-0 text-right">{c.n}.</span>
                  <Link href={`/projects/${c.id}`} className="text-ink-2 hover:text-cherry hover:underline underline-offset-2">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </aside>
  );
}
