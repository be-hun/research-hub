"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from "@/lib/conversations";
import { EXPORT_FOOTER } from "@/lib/exportChat";
import type { ConversationSummary, ProfileInput } from "@/lib/types";
import AssistantChat, { type Message } from "./AssistantChat";
import ConversationHistory, { type HistoryState } from "./ConversationHistory";
import Icon from "./Icon";

/** Point the address bar at this chat (or a fresh one) without a navigation, so a reload reopens it. */
function setUrl(id: string | null) {
  try {
    window.history.replaceState(window.history.state, "", id ? `/ask?c=${encodeURIComponent(id)}` : "/ask");
  } catch {
    // Some embedded browsers block history changes; the chat still works.
  }
}

/**
 * The Ask page's chat plus its saved history: a sidebar on wide screens, a drawer behind a History button on narrow
 * ones. History is optional: if the conversations API fails, the chat works exactly as it does without it.
 */
export default function AskWorkspace({
  profile,
  suggestions,
  initialQuestion,
  initialConversationId,
  intro,
}: {
  profile: ProfileInput | null;
  suggestions?: string[];
  initialQuestion: string;
  initialConversationId: string;
  /** The page heading, shown above the chat column. */
  intro: ReactNode;
}) {
  const signedIn = !!profile;
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [listState, setListState] = useState<HistoryState>("loading");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Message[]>([]);
  const [chatKey, setChatKey] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const openSeq = useRef(0);
  const drawerButton = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listConversations(signedIn));
      setListState("ready");
    } catch {
      setListState("error");
    }
  }, [signedIn]);

  const open = useCallback(
    async (id: string) => {
      setDrawer(false);
      setOpenFailed(false);
      setOpening(id);
      const seq = ++openSeq.current;
      try {
        const c = await getConversation(signedIn, id);
        if (seq !== openSeq.current) return; // another chat was picked meanwhile
        setLoaded(
          c.messages.map((m) => ({ role: m.role, text: m.text, ...(m.reply ? { reply: m.reply } : {}) })),
        );
        setActiveId(c.id);
        setChatKey((k) => k + 1);
        setUrl(c.id);
      } catch {
        if (seq !== openSeq.current) return;
        setOpenFailed(true);
      } finally {
        if (seq === openSeq.current) setOpening(null);
      }
    },
    [signedIn],
  );

  function newChat() {
    openSeq.current++;
    setOpening(null);
    setOpenFailed(false);
    setDrawer(false);
    setActiveId(null);
    setLoaded([]);
    setChatKey((k) => k + 1);
    setUrl(null);
  }

  useEffect(() => {
    refresh();
    // A shared ?q= link starts a new chat; ?c= reopens a saved one.
    if (initialConversationId && !initialQuestion) open(initialConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The drawer: Escape closes it, and focus goes back to the History button.
  useEffect(() => {
    if (!drawer) return;
    const button = drawerButton.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [drawer]);

  function onConversation(id: string | null) {
    if (id && id !== activeId) {
      setActiveId(id);
      setUrl(id);
    }
    refresh();
  }

  async function rename(id: string, title: string) {
    try {
      const updated = await renameConversation(signedIn, id, title);
      setItems((list) => list.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      return true;
    } catch {
      return false;
    }
  }

  async function remove(id: string) {
    try {
      await deleteConversation(signedIn, id);
      setItems((list) => list.filter((c) => c.id !== id));
      if (id === activeId) newChat();
      return true;
    } catch {
      return false;
    }
  }

  const history = (
    <ConversationHistory
      items={items}
      state={listState}
      activeId={activeId}
      onSelect={open}
      onNew={newChat}
      onRename={rename}
      onDelete={remove}
      onRetry={() => {
        setListState("loading");
        refresh();
      }}
    />
  );
  const title = items.find((c) => c.id === activeId)?.title ?? null;

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 print:block">
      <aside aria-label="Saved chats" className="hidden lg:block print:hidden">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-1">{history}</div>
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-label="Saved chats">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 cursor-default"
            aria-label="Close saved chats"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] bg-surface border-r border-line shadow-card p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h3">History</h2>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="p-1.5 rounded-md hover:bg-canvas"
                aria-label="Close saved chats"
                autoFocus
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            {history}
          </div>
        </div>
      )}

      <div className="max-w-3xl min-w-0">
        {intro}
        {openFailed && (
          <p className="text-small text-ink-2 bg-canvas border border-line rounded-lg px-4 py-3 mb-4 print:hidden" role="status">
            That saved chat couldn&apos;t be opened. It may have been deleted. You can start a new one below.
          </p>
        )}
        {opening ? (
          <div className="space-y-3 animate-pulse min-h-[300px]" aria-label="Opening chat">
            <div className="h-9 w-28 rounded-full bg-line/70" />
            <div className="ml-auto h-12 w-2/3 rounded-2xl bg-line/70" />
            <div className="h-32 rounded-xl bg-line/70" />
          </div>
        ) : (
          <AssistantChat
            key={chatKey}
            profile={profile}
            suggestions={suggestions}
            initialQuestion={chatKey === 0 ? initialQuestion : ""}
            initialMessages={loaded}
            conversationId={activeId}
            title={title}
            onConversation={onConversation}
            toolbar={
              <>
                <button
                  ref={drawerButton}
                  type="button"
                  onClick={() => setDrawer(true)}
                  aria-expanded={drawer}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line-strong bg-surface text-small font-medium text-ink-2 hover:border-cherry hover:text-cherry"
                >
                  <Icon name="history" size={18} />
                  History
                </button>
                <button
                  type="button"
                  onClick={newChat}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line-strong bg-surface text-small font-medium text-ink-2 hover:border-cherry hover:text-cherry"
                >
                  <Icon name="add" size={18} />
                  New
                </button>
              </>
            }
          />
        )}
        <p className="hidden print:block text-tiny text-ink-3 mt-8">
          {EXPORT_FOOTER}
        </p>
      </div>
    </div>
  );
}
