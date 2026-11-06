// Turn an Ask conversation into Markdown, JSON or plain text. Pure functions: no DOM, no fetch, so they work for a
// saved conversation and for an unsaved one alike, from the messages already on screen.
import { college } from "./colleges";
import type { AssistantPerson, AssistantReply } from "./types";

export interface ExportMessage {
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply | null;
  error?: boolean;
}

export const EXPORT_FOOTER = "Generated from Temple public research records, check before relying on it.";

const projectUrl = (origin: string, id: string) => `${origin}/projects/${encodeURIComponent(id)}`;
const personUrl = (origin: string, p: AssistantPerson) =>
  p.researcherId
    ? `${origin}/researchers/${encodeURIComponent(p.researcherId)}`
    : `${origin}/search?q=${encodeURIComponent(p.name)}`;

/** Markdown link text can't hold unescaped brackets. */
const mdText = (s: string) => s.replace(/([\\[\]])/g, "\\$1");

/** A filename-safe slug of the title, e.g. "ask-who-studies-alzheimers-disease". */
export function exportFilename(title: string, ext: "md" | "json"): string {
  const slug = title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `ask-${slug || "conversation"}.${ext}`;
}

/** The chat's title: the saved one, else the first question. */
export function exportTitle(messages: ExportMessage[], saved?: string | null): string {
  return saved?.trim() || messages.find((m) => m.role === "user")?.text.trim().slice(0, 80) || "Ask conversation";
}

function cardLines(reply: AssistantReply, origin: string, link: (text: string, url: string) => string): string[] {
  if (reply.mode === "people" || reply.mode === "team") {
    return reply.people.map((p) => {
      const where = [p.department, college(p.college)?.short].filter(Boolean).join(", ");
      const focus = p.focus ? (reply.mode === "team" ? `Brings: ${p.focus}` : p.focus) : "";
      return `- ${link(p.name, personUrl(origin, p))}${[where, focus].filter(Boolean).map((s) => ` — ${s}`).join("")}`;
    });
  }
  return reply.records.map(
    (r) => `- [${r.n}] ${link(r.project.title, projectUrl(origin, r.project.id))}${r.takeaway ? ` — ${r.takeaway}` : ""}`,
  );
}

function render(
  messages: ExportMessage[],
  title: string,
  origin: string,
  md: boolean,
): string {
  const link = md ? (t: string, u: string) => `[${mdText(t)}](${u})` : (t: string, u: string) => `${t} (${u})`;
  const out: string[] = [md ? `# ${title}` : title, ""];
  for (const m of messages) {
    if (m.role === "user") {
      out.push(md ? `## ${m.text.replace(/\s+/g, " ").trim()}` : `Q: ${m.text.trim()}`, "");
      continue;
    }
    const reply = m.reply;
    if (!reply) {
      out.push(md ? `_${m.text}_` : `A: ${m.text}`, "");
      continue;
    }
    out.push(md ? reply.summary : `A: ${reply.summary}`, "");
    if (reply.searchedFor) out.push(md ? `_Searched: ${reply.searchedFor}_` : `Searched: ${reply.searchedFor}`, "");
    const cards = cardLines(reply, origin, link);
    if (cards.length) {
      const heading =
        reply.mode === "team" ? "Suggested team" : reply.mode === "people" ? "Researchers" : "Records";
      out.push(md ? `**${heading}**` : `${heading}:`, "", ...cards, "");
    }
  }
  out.push(md ? "---" : "--", "", md ? `_${EXPORT_FOOTER}_` : EXPORT_FOOTER, "");
  return out.join("\n");
}

/** Markdown: each question as a heading, then the answer's summary and its cards linked to this site. */
export function toMarkdown(messages: ExportMessage[], title: string, origin: string): string {
  return render(messages, title, origin, true);
}

/** Plain text for the clipboard: the same content as the Markdown, with links written out as URLs. */
export function toPlainText(messages: ExportMessage[], title: string, origin: string): string {
  return render(messages, title, origin, false);
}

/** The raw messages and replies, as the API returned them. */
export function toJson(
  messages: ExportMessage[],
  title: string,
  origin: string,
  conversationId: string | null = null,
  exportedAt = new Date(),
): string {
  return JSON.stringify(
    {
      title,
      conversationId,
      source: origin,
      exportedAt: exportedAt.toISOString(),
      note: EXPORT_FOOTER,
      messages: messages.map((m) => ({ role: m.role, text: m.text, reply: m.reply ?? null, ...(m.error ? { error: true } : {}) })),
    },
    null,
    2,
  );
}
