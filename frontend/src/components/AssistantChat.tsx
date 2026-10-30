"use client";

import { useState } from "react";
import Icon from "./Icon";

interface Source {
  n: number;
  id: string;
  title: string;
  url: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  error?: boolean; // not sent back as conversation history
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const SUGGESTIONS = [
  "Who at Temple studies Alzheimer's disease, and what are they funded to do?",
  "What substance use research is happening across Temple colleges?",
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
    let reply: Message = {
      role: "assistant",
      text: "The assistant backend is not connected yet. Set NEXT_PUBLIC_API_URL to enable answers.",
      error: true,
    };
    if (API_URL) {
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
    }
    setMessages([...next, reply]);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-[320px] space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-body-sm text-tertiary">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block text-left bg-white border border-[#C7D2FE] hover:bg-[#EEF2FF] px-3 py-2 rounded-lg text-body-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-xl bg-primary-container text-white px-4 py-3 rounded-2xl text-body-md">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center shrink-0">
                <Icon name="auto_awesome" size={18} />
              </div>
              <div className="flex-1 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-4 text-body-md text-[#1E1B4B]">
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <ol className="mt-3 pt-3 border-t border-[#C7D2FE] space-y-1 text-body-sm">
                    {m.sources.map((s) => (
                      <li key={s.n} className="flex gap-2">
                        <span className="font-semibold">[{s.n}]</span>
                        <span>
                          <a href={`/projects/${s.id}`} className="underline hover:text-primary">{s.title}</a>
                          {" · "}
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-tertiary hover:underline">
                            NIH RePORTER
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
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="bg-white border border-[#CBD5E1] rounded-xl p-2.5 flex items-end gap-2 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/15"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ask a question about Temple research…"
          className="flex-1 resize-none border-0 p-1 text-body-sm focus:ring-0 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-primary-container hover:bg-[#821A2B] text-white p-2 rounded-lg disabled:opacity-50"
          aria-label="Send message"
        >
          <Icon name="arrow_upward" size={20} />
        </button>
      </form>
    </div>
  );
}
