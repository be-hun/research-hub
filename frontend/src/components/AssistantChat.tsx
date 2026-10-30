"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import type { AssistantSource } from "@/lib/types";
import Icon from "./Icon";

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: AssistantSource[];
  error?: boolean; // not sent back as conversation history
}

const SUGGESTIONS = [
  "Who at Temple studies Alzheimer's disease, and what are they funded to do?",
  "What research on opioid addiction is happening across Temple colleges?",
  "Are any clinical trials at Temple studying heart failure, and who sponsors them?",
];

export default function AssistantChat() {
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
        body: JSON.stringify({ messages: history }),
      });
      const body = await res.json().catch(() => ({}));
      reply = res.ok
        ? { role: "assistant", text: body.reply, sources: body.sources }
        : { role: "assistant", text: body.detail ?? "Something went wrong reaching the assistant. Try again.", error: true };
    } catch {
      reply = { role: "assistant", text: "Something went wrong reaching the assistant. Try again.", error: true };
    }
    setMessages([...next, reply]);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="min-h-[300px] space-y-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-small text-ink-3">Try asking</p>
            {SUGGESTIONS.map((s) => (
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
            <div key={i} className="ml-auto max-w-xl bg-cherry text-white px-4 py-3 rounded-2xl rounded-br-md">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center shrink-0" aria-hidden="true">
                <Icon name="auto_awesome" size={18} />
              </div>
              <div
                className={`flex-1 border rounded-2xl rounded-tl-md p-4 ${m.error ? "bg-canvas border-line text-ink-2" : "bg-surface border-line"}`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <ol className="mt-4 pt-3 border-t border-line space-y-1.5 text-small">
                    {m.sources.map((s) => (
                      <li key={s.n} className="flex gap-2">
                        <span className="font-semibold text-ink-3 num">[{s.n}]</span>
                        <span>
                          <Link href={`/projects/${s.id}`} className="text-ink hover:text-cherry underline underline-offset-2">
                            {s.title}
                          </Link>
                          <span className="text-ink-3"> · </span>
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-ink-3 hover:underline">
                            {s.label} ↗
                          </a>
                        </span>
                      </li>
                    ))}
                  </ol>
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
