"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { API_URL } from "@/lib/api";
import { KIND_LABELS } from "@/lib/colleges";
import { count, yearRange } from "@/lib/format";
import type { AssistantPerson, AssistantRecord, AssistantReply, AssistantRequest, ProfileInput, Project } from "@/lib/types";
import Icon from "./Icon";
import { CollegeTag, KindTag, StatusChip } from "./Tags";

interface Message {
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
  error?: boolean; // not sent back as conversation history
}

const SUGGESTIONS = [
  "Who at Temple studies Alzheimer's disease?",
  "What opioid addiction research is happening across Temple colleges?",
  "Which heart failure clinical trials are at Temple?",
];

/** The [n] number that ties a sentence in the summary to a card below it. */
function Num({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded bg-canvas border border-line text-tiny font-semibold text-ink-3 num">
      {n}
    </span>
  );
}

function Summary({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/);
  return (
    <p className="text-body text-ink">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        return m ? (
          <Fragment key={i}>
            {" "}
            <Num n={Number(m[1])} />
          </Fragment>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </p>
  );
}

function facts(p: Project): string[] {
  const years = p.kind === "publication" ? String(p.startYear) : yearRange(p.startYear, p.endYear);
  if (p.kind === "award") return [years, p.agency, p.pi.name].filter(Boolean);
  if (p.kind === "trial") return [years, `Sponsor: ${p.funder}`];
  return [years, p.agency, p.fundingTypes.join(", ")].filter(Boolean);
}

function RecordCard({ record }: { record: AssistantRecord }) {
  const p = record.project;
  return (
    <li className="bg-surface border border-line rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-1.5">
        <Num n={record.n} />
        <KindTag kind={p.kind} />
        <StatusChip label={p.statusLabel} active={p.active} />
        {p.colleges.slice(0, 2).map((c) => (
          <CollegeTag key={c} id={c} />
        ))}
      </div>
      <Link href={`/projects/${p.id}`} className="block font-semibold leading-snug hover:text-cherry hover:underline underline-offset-2">
        {p.title}
      </Link>
      {record.takeaway && <p className="text-small text-ink-2 mt-1">{record.takeaway}</p>}
      <p className="text-tiny text-ink-3 mt-1.5 truncate">{facts(p).join(" · ")}</p>
    </li>
  );
}

function PersonCard({ person }: { person: AssistantPerson }) {
  const t = person.totals;
  const totals = [
    t.grants && count(t.grants, "grant"),
    t.trials && count(t.trials, "trial"),
    t.publications && count(t.publications, "paper"),
  ].filter(Boolean);
  return (
    <li className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/search?q=${encodeURIComponent(person.name)}`}
            className="font-semibold hover:text-cherry hover:underline underline-offset-2"
          >
            {person.name}
          </Link>
          <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
            <CollegeTag id={person.college} />
            {person.department && <span className="text-tiny text-ink-3 truncate">{person.department}</span>}
          </div>
        </div>
        {totals.length > 0 && (
          <span className="text-tiny text-ink-3 text-right shrink-0 num">{totals.join(" · ")} at Temple</span>
        )}
      </div>
      {person.focus && <p className="text-small text-ink-2 mt-2">{person.focus}</p>}
      <ul className="mt-2 space-y-1">
        {person.records.map((r) => (
          <li key={r.id} className="flex items-baseline gap-2 text-tiny">
            <Num n={r.n} />
            <span className="text-ink-3 shrink-0">
              {KIND_LABELS[r.kind]} · {r.role}
            </span>
            <Link href={`/projects/${r.id}`} className="text-ink-2 hover:text-cherry hover:underline truncate">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Answer({ reply, onAsk }: { reply: AssistantReply; onAsk: (q: string) => void }) {
  const isPeople = reply.mode === "people";
  const n = isPeople ? reply.people.length : reply.records.length;
  return (
    <div className="space-y-4">
      <Summary text={reply.summary} />
      {n > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-2">
            <Icon name={isPeople ? "group" : "description"} size={16} />
            {isPeople ? count(n, "researcher") : count(n, "record")}
          </h3>
          <ul className="space-y-2">
            {isPeople
              ? reply.people.map((p) => <PersonCard key={p.name} person={p} />)
              : reply.records.map((r) => <RecordCard key={r.n} record={r} />)}
          </ul>
        </section>
      )}
      {reply.followUps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reply.followUps.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="inline-flex items-center gap-1 text-small px-3 py-1.5 rounded-full bg-surface border border-line hover:border-cherry hover:text-cherry"
            >
              <Icon name="arrow_forward" size={14} />
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssistantChat({
  profile = null,
  suggestions = SUGGESTIONS,
}: {
  /** Demo account: the signed-in profile's interests, sent so answers can lean toward them. */
  profile?: ProfileInput | null;
  suggestions?: string[];
} = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user" as const, text: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    let reply: Message;
    try {
      const history = next.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
      const res = await fetch(`${API_URL}/api/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, ...(profile ? { profile } : {}) } satisfies AssistantRequest),
      });
      const body = await res.json().catch(() => ({}));
      reply = res.ok
        ? { role: "assistant", text: (body as AssistantReply).summary, reply: body as AssistantReply }
        : { role: "assistant", text: body.detail ?? "Something went wrong reaching the assistant. Try again.", error: true };
    } catch {
      reply = { role: "assistant", text: "Something went wrong reaching the assistant. Try again.", error: true };
    }
    setMessages([...next, reply]);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="min-h-[300px] space-y-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-small text-ink-3">Ask about people (who works on something) or about the research itself.</p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left bg-surface border border-line hover:border-cherry px-4 py-3 rounded-lg text-small"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-xl w-fit bg-cherry text-white px-4 py-3 rounded-2xl rounded-br-md">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center shrink-0" aria-hidden="true">
                <Icon name="auto_awesome" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                {m.reply ? (
                  <Answer reply={m.reply} onAsk={send} />
                ) : (
                  <p className="bg-canvas border border-line text-ink-2 rounded-xl p-4">{m.text}</p>
                )}
              </div>
            </div>
          ),
        )}
        {busy && <p className="text-small text-ink-3 pl-11">Searching the records…</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="bg-surface border border-line-strong rounded-xl p-2 flex items-end gap-2 focus-within:border-cherry shadow-card"
      >
        <label htmlFor="ask" className="sr-only">
          Your question
        </label>
        <textarea
          id="ask"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          maxLength={1000}
          rows={2}
          placeholder="Ask about research at Temple…"
          className="flex-1 resize-none border-0 p-2 focus:outline-none bg-transparent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-cherry hover:bg-cherry-dark text-white p-2.5 rounded-lg disabled:opacity-40"
          aria-label="Send question"
        >
          <Icon name="arrow_upward" size={20} />
        </button>
      </form>
    </div>
  );
}
