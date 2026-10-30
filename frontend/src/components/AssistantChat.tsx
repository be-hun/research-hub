"use client";

import { useState } from "react";
import Icon from "./Icon";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const SUGGESTIONS = [
  "Who at Temple works on AI for maternal health, and is anyone looking for students?",
  "Compare Dr. Thorne and Dr. Rostova's grant pipelines",
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
    let reply = "The assistant backend is not connected yet. Set NEXT_PUBLIC_API_URL to enable answers.";
    if (API_URL) {
      try {
        const res = await fetch(`${API_URL}/api/assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        if (!res.ok) throw new Error(String(res.status));
        reply = (await res.json()).reply;
      } catch {
        reply = "Something went wrong reaching the assistant. Try again.";
      }
    }
    setMessages([...next, { role: "assistant", text: reply }]);
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
              <div className="flex-1 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-4 text-body-md text-[#1E1B4B] whitespace-pre-wrap">
                {m.text}
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
