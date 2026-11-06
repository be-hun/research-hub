// Saved Ask conversations (browser only). Every request names its owner with X-Client-Id: the demo account when
// signed in, otherwise a random id this browser keeps. There are no real accounts, so this is a convenience, not
// access control.
import { API_URL } from "./api";
import type { Conversation, ConversationList, ConversationSummary } from "./types";

const CLIENT_ID_KEY = "rc_client_id";
const DEMO_CLIENT_ID = "demo-maya";
const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;
let memoryId = ""; // when storage is blocked, one id for this page's life

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // Not a secure context: fall through.
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** The owner id for this browser: "demo-maya" when signed in to the demo, else a stored random UUID. */
export function clientId(signedIn: boolean): string {
  if (signedIn) return DEMO_CLIENT_ID;
  try {
    const stored = window.localStorage.getItem(CLIENT_ID_KEY);
    // The API rejects anything else with a 400, which would break Ask too; replace a damaged value.
    if (stored && VALID_ID.test(stored)) return stored;
    const id = randomId();
    window.localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    memoryId ||= randomId();
    return memoryId;
  }
}

async function call<T>(signedIn: boolean, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Client-Id": clientId(signedIn), ...init.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function listConversations(signedIn: boolean): Promise<ConversationSummary[]> {
  return call<ConversationList>(signedIn, "/api/conversations").then((r) => r.conversations ?? []);
}

export function getConversation(signedIn: boolean, id: string): Promise<Conversation> {
  return call<Conversation>(signedIn, `/api/conversations/${encodeURIComponent(id)}`);
}

export function renameConversation(signedIn: boolean, id: string, title: string): Promise<ConversationSummary> {
  return call<ConversationSummary>(signedIn, `/api/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(signedIn: boolean, id: string): Promise<void> {
  return call<void>(signedIn, `/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type HistoryGroup = { label: string; items: ConversationSummary[] };

/** Newest-first summaries split into Today / Previous 7 days / Older, by local calendar day. Empty groups are left out. */
export function groupByDate(items: ConversationSummary[], now = new Date()): HistoryGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
  const groups: HistoryGroup[] = [
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of items) {
    const t = Date.parse(c.updatedAt);
    groups[t >= startOfToday ? 0 : t >= weekAgo ? 1 : 2].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}
