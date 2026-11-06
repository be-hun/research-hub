"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { clientId } from "@/lib/conversations";
import { KIND_LABELS } from "@/lib/colleges";
import { count, yearRange } from "@/lib/format";
import type {
  AssistantPerson,
  AssistantRecord,
  AssistantReply,
  AssistantRequest,
  ChatMessage,
  ProfileInput,
  Project,
} from "@/lib/types";
import AnswerActions from "./AnswerActions";
import ExportMenu from "./ExportMenu";
import Icon from "./Icon";
import IntroDraftButton from "./IntroDraftButton";
import { CollegeTag, KindTag, StatusChip } from "./Tags";

export interface Message {
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
  error?: boolean; // not sent back as conversation history
}

const SUGGESTIONS = [
  "Who at Temple studies Alzheimer's disease?",
  "What opioid addiction research is happening across Temple colleges?",
  "Which heart failure clinical trials are at Temple?",
  "Build me a team for a grant on machine learning in cardiovascular disease",
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

/** A person in a people answer, or a member of a suggested team (then `focus` is what they bring to it). */
function PersonCard({
  person,
  profile,
  team = false,
}: {
  person: AssistantPerson;
  profile: ProfileInput | null;
  team?: boolean;
}) {
  const t = person.totals;
  const totals = [
    t.grants && count(t.grants, "grant"),
    t.trials && count(t.trials, "trial"),
    t.publications && count(t.publications, "paper"),
  ].filter(Boolean);
  return (
    <li className="bg-surface border border-line rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <Link
            href={
              person.researcherId
                ? `/researchers/${person.researcherId}`
                : `/search?q=${encodeURIComponent(person.name)}`
            }
            className="font-semibold hover:text-cherry hover:underline underline-offset-2"
          >
            {person.name}
          </Link>
          {person.inYourMatches && (
            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-cherry-tint text-cherry-dark text-tiny font-medium">
              In your matches
            </span>
          )}
          <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
            <CollegeTag id={person.college} short={!team} />
            {team && !person.college && <span className="text-tiny text-ink-3">College not listed</span>}
            {person.department && <span className="text-tiny text-ink-3 truncate">{person.department}</span>}
          </div>
        </div>
        {totals.length > 0 && (
          <span className="text-tiny text-ink-3 sm:text-right max-w-full num">{totals.join(" · ")} at Temple</span>
        )}
      </div>
      {person.focus &&
        (team ? (
          <p className="text-small text-ink-2 mt-2">
            <span className="font-semibold text-ink">Brings: </span>
            {person.focus}
          </p>
        ) : (
          <p className="text-small text-ink-2 mt-2">{person.focus}</p>
        ))}
      <ul className="mt-2 space-y-1">
        {person.records.map((r) => (
          <li key={r.id} className="flex items-baseline gap-2 text-tiny min-w-0">
            <Num n={r.n} />
            <span className="text-ink-3 shrink-0">
              {KIND_LABELS[r.kind]} · {r.role}
            </span>
            <Link href={`/projects/${r.id}`} className="min-w-0 text-ink-2 hover:text-cherry hover:underline truncate">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
      {profile && person.researcherId && (
        <div className="mt-3 print:hidden">
          <IntroDraftButton researcherId={person.researcherId} name={person.name} profile={profile} />
        </div>
      )}
    </li>
  );
}

function Answer({
  reply,
  question,
  signedIn,
  onAsk,
  profile,
}: {
  reply: AssistantReply;
  question: string;
  signedIn: boolean;
  onAsk: (q: string) => void;
  profile: ProfileInput | null;
}) {
  const isTeam = reply.mode === "team";
  const isPeople = reply.mode === "people";
  const n = isPeople ? reply.people.length : reply.records.length;
  const colleges = new Set(reply.people.map((p) => p.college).filter(Boolean)).size;
  return (
    <div className="space-y-4">
      <Summary text={reply.summary} />
      {reply.searchedFor && <p className="text-tiny text-ink-3">Searched: {reply.searchedFor}</p>}
      {isTeam && reply.people.length > 0 && (
        <section>
          <h3 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-tiny font-semibold uppercase tracking-wider text-ink-3">
            <Icon name="group" size={16} />
            Suggested team
            <span className="font-normal normal-case tracking-normal">
              · {count(reply.people.length, "researcher")}
              {colleges > 1 && ` from ${count(colleges, "college")}`}
            </span>
          </h3>
          <p className="text-tiny text-ink-3 mt-1 mb-2">
            Picked to span colleges. Each &quot;Brings&quot; line is written by AI from the records listed under it.
          </p>
          <ul className="space-y-2">
            {reply.people.map((p) => (
              <PersonCard key={p.name} person={p} profile={profile} team />
            ))}
          </ul>
        </section>
      )}
      {!isTeam && n > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-ink-3 mb-2">
            <Icon name={isPeople ? "group" : "description"} size={16} />
            {isPeople ? count(n, "researcher") : count(n, "record")}
          </h3>
          <ul className="space-y-2">
            {isPeople
              ? reply.people.map((p) => <PersonCard key={p.name} person={p} profile={profile} />)
              : reply.records.map((r) => <RecordCard key={r.n} record={r} />)}
          </ul>
        </section>
      )}
      {reply.mode !== "none" && (
        <div className="print:hidden">
          <AnswerActions reply={reply} question={question} signedIn={signedIn} />
        </div>
      )}
      {reply.followUps.length > 0 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {reply.followUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(q)}
              className="inline-flex items-center gap-1 text-left text-small px-3 py-1.5 rounded-full bg-surface border border-line hover:border-cherry hover:text-cherry focus-visible:border-cherry"
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

function Avatar() {
  return (
    <div className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center shrink-0" aria-hidden="true">
      <Icon name="auto_awesome" size={18} />
    </div>
  );
}

/**
 * While the request runs: placeholder cards and a status line. The browser can't see the backend's progress, so the
 * second line is only a timer; both steps are what the backend does (search first, then write).
 */
function Waiting({ slow }: { slow: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 space-y-3">
        <p className="flex items-center gap-2 text-small text-ink-2">
          <span className="w-2 h-2 rounded-full bg-cherry animate-pulse shrink-0" aria-hidden="true" />
          {slow ? "Reading the records and writing an answer…" : "Searching Temple records…"}
        </p>
        <ul className="space-y-2 animate-pulse" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="bg-surface border border-line rounded-xl p-4">
              <div className="h-3 w-28 rounded bg-line" />
              <div className="h-4 w-4/5 rounded bg-line mt-3" />
              <div className="h-3 w-1/2 rounded bg-line mt-2" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// The API takes a short history. Seven alternating turns start on a user turn and end on the new question.
const HISTORY = 7;
const FAILED = "The assistant couldn't answer just now.";

/** The conversation as the API wants it: no failed exchanges (an error and the question it answered), most recent last. */
function history(messages: Message[]): ChatMessage[] {
  const ok = messages.filter((m, i) => !m.error && !(m.role === "user" && messages[i + 1]?.error));
  const recent = ok.slice(-HISTORY);
  while (recent.length > 1 && recent[0].role !== "user") recent.shift();
  return recent.map(({ role, text }) => ({ role, text }));
}

export default function AssistantChat({
  profile = null,
  suggestions = SUGGESTIONS,
  initialQuestion = "",
  initialMessages = [],
  conversationId: savedId = null,
  title = null,
  onConversation,
  toolbar,
}: {
  /** Demo account: the signed-in profile's interests, sent so answers can lean toward them. */
  profile?: ProfileInput | null;
  suggestions?: string[];
  /** A shared /ask?q=... link: asked as soon as the page opens. */
  initialQuestion?: string;
  /** A reopened saved conversation. The chat starts from these and continues it (remount with a key to switch). */
  initialMessages?: Message[];
  conversationId?: string | null;
  /** The saved title, for exports. */
  title?: string | null;
  /** After each answer: the conversation id the server saved it under (null when it wasn't saved). */
  onConversation?: (id: string | null) => void;
  /** Controls shown at the left of the chat's header row, e.g. the History button. */
  toolbar?: ReactNode;
} = {}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const conversationRef = useRef<string | null>(savedId);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const waitingRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  useEffect(() => {
    if (!busy) return;
    setSlow(false);
    waitingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const timer = setTimeout(() => setSlow(true), 2000);
    return () => clearTimeout(timer);
  }, [busy]);

  async function send(text: string, base: Message[] = messages) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Message[] = [...base, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    let reply: Message;
    try {
      const ask = () =>
        fetch(`${API_URL}/api/assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Client-Id": clientId(!!profile) },
          body: JSON.stringify({
            messages: history(next),
            conversationId: conversationRef.current,
            ...(profile ? { profile } : {}),
          } satisfies AssistantRequest),
        });
      let res = await ask();
      if (res.status === 404 && conversationRef.current) {
        // The saved chat is gone (deleted elsewhere): answer anyway, saving it as a new chat.
        conversationRef.current = null;
        res = await ask();
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok && typeof body?.conversationId === "string") conversationRef.current = body.conversationId;
      // A 422 carries a list of validation errors in `detail`; only a plain sentence is fit to show.
      reply =
        res.ok && typeof body?.summary === "string"
          ? { role: "assistant", text: (body as AssistantReply).summary, reply: body as AssistantReply }
          : { role: "assistant", text: typeof body?.detail === "string" ? body.detail : FAILED, error: true };
    } catch {
      reply = { role: "assistant", text: FAILED, error: true };
    }
    // A chat closed while it was waiting (New chat, another conversation) doesn't report back.
    if (!mounted.current) return;
    setMessages([...next, reply]);
    setBusy(false);
    onConversation?.(conversationRef.current);
  }

  useEffect(() => {
    if (askedInitial.current || !initialQuestion.trim()) return;
    askedInitial.current = true;
    send(initialQuestion);
    // Only once, on the first render: a shared link asks its question a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ask the failed question again, replacing the failed exchange. */
  function retry() {
    const question = messages[messages.length - 2];
    if (question?.role === "user") send(question.text, messages.slice(0, -2));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2 min-w-0">{toolbar}</div>
        <ExportMenu messages={messages} title={title} conversationId={conversationRef.current} />
      </div>
      <div className="min-h-[300px] space-y-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-small text-ink-3">
              Ask about people (who works on something), the research itself, or a team for a grant.
            </p>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block w-full text-left bg-surface border border-line hover:border-cherry focus-visible:border-cherry px-4 py-3 rounded-lg text-small"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-xl w-fit bg-cherry text-white px-4 py-3 rounded-2xl rounded-br-md break-words">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <Avatar />
              <div className="flex-1 min-w-0">
                {m.reply ? (
                  <Answer
                    reply={m.reply}
                    question={messages[i - 1]?.text ?? ""}
                    signedIn={!!profile}
                    onAsk={send}
                    profile={profile}
                  />
                ) : (
                  <div className="bg-canvas border border-line text-ink-2 rounded-xl p-4">
                    <p>{m.text}</p>
                    {m.error && i === messages.length - 1 && (
                      <button
                        type="button"
                        onClick={retry}
                        disabled={busy}
                        className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cherry hover:bg-cherry-dark text-white text-small font-medium disabled:opacity-40"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div ref={waitingRef}>
            <Waiting slow={slow} />
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="bg-surface border border-line-strong rounded-xl p-2 flex items-end gap-2 focus-within:border-cherry shadow-card print:hidden"
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
