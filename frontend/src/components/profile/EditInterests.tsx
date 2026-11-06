"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import InterestsEditor from "@/components/InterestsEditor";
import type { Interests } from "@/lib/profileLimits";
import type { TopicRef } from "@/lib/types";
import ProfileCard from "./ProfileCard";

// The header's "Edit interests" button and the pencil on the Research interests card open the same editor. The
// editing flag lives here, above both, so the server-rendered parts of the page in between stay server components.
const EditingContext = createContext<{ editing: boolean; open: () => void; close: () => void }>({
  editing: false,
  open: () => {},
  close: () => {},
});

const CARD_ID = "interests";

function reveal() {
  const card = document.getElementById(CARD_ID);
  if (!card) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  card.focus({ preventScroll: true });
}

export function EditInterestsProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const open = useCallback(() => {
    setEditing(true);
    window.requestAnimationFrame(reveal);
  }, []);
  const close = useCallback(() => setEditing(false), []);
  const value = useMemo(() => ({ editing, open, close }), [editing, open, close]);
  return <EditingContext.Provider value={value}>{children}</EditingContext.Provider>;
}

/** The primary button in the profile header. */
export function EditInterestsButton() {
  const { editing, open } = useContext(EditingContext);
  return (
    <button
      type="button"
      onClick={open}
      aria-controls={CARD_ID}
      aria-expanded={editing}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-cherry text-white text-small font-semibold hover:bg-cherry-dark"
    >
      <Icon name="edit" size={18} />
      Edit interests
    </button>
  );
}

/**
 * The Research interests card. It shows `view` (the topic and keyword chips, rendered on the server) until someone
 * edits, then the editor. Every change is saved by a server action that re-renders the page, so the chips and all
 * the matches update while the editor stays open.
 */
export function InterestsCard({
  view,
  topics,
  current,
  edited,
}: {
  view: React.ReactNode;
  topics: TopicRef[];
  current: Interests;
  edited: boolean;
}) {
  const { editing, open, close } = useContext(EditingContext);
  return (
    <ProfileCard
      id={CARD_ID}
      title="Research interests"
      subtitle={editing ? "Changes save as you make them, and your matches update." : "What your matches are based on."}
      action={
        editing ? (
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-ink text-white text-small font-semibold hover:bg-ink-2 shrink-0"
          >
            <Icon name="check" size={18} />
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            className="w-10 h-10 -mr-2 -mt-1.5 rounded-full flex items-center justify-center text-ink-2 hover:bg-canvas hover:text-cherry shrink-0"
            aria-label="Edit research interests"
          >
            <Icon name="edit" size={22} />
          </button>
        )
      }
    >
      {editing ? <InterestsEditor topics={topics} current={current} edited={edited} /> : view}
    </ProfileCard>
  );
}
