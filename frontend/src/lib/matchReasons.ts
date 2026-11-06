// Turn the backend's match reasons into short, plain-language parts. The wording is fixed in `_reasons` in
// backend/app/compatibility.py; change both together. Anything this file doesn't recognise is passed through.

// "source" says how the shared topics were tagged (funder data or keywords). It belongs in a score breakdown, not
// in the chips, which say what the match is about.
export type ReasonChip = { key: string; label: string; kind: "topic" | "keyword" | "college" | "source" };

/** The scoring recipe, as `_score` applies it. Shown next to every match score. */
export const SCORE_PARTS = {
  topics: "up to 60: 24 per shared topic, less when the record's topic comes only from keywords",
  keywords: "up to 32: 2 to 12 per shared interest, more for rarer and multi-word ones",
  sameCollege: "+8",
  otherCollege: "+5 for people outside your college",
  minimum: 12,
};

/**
 * "Shares Aging & Alzheimer's", "Shares stored terms: down syndrome, sensors", "Linked to the same college" become
 * deduplicated chips. The backend matches interests as whole phrases, so each term is one chip. `you` picks
 * "Your college" over "Same college".
 */
export function reasonChips(reasons: string[], you = true): ReasonChip[] {
  const chips = new Map<string, ReasonChip>();
  for (const r of reasons) {
    if (r.startsWith("Shares stored terms:")) {
      r.slice("Shares stored terms:".length)
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean)
        .forEach((w) => chips.set(`k:${w.toLowerCase()}`, { key: `k:${w.toLowerCase()}`, label: w, kind: "keyword" }));
    } else if (r.startsWith("Shares ")) {
      const label = r.slice("Shares ".length);
      chips.set(`t:${label}`, { key: `t:${label}`, label, kind: "topic" });
    } else if (r === "Supported by funder-defined topic data") {
      chips.set("s:funder", { key: "s:funder", label: "Topic from funder data", kind: "source" });
    } else if (r === "Supported by stored keyword topic data") {
      chips.set("s:keywords", { key: "s:keywords", label: "Topic from keywords", kind: "source" });
    } else if (r === "Linked to the same college") {
      chips.set("c:same", { key: "c:same", label: you ? "Your college" : "Same college", kind: "college" });
    } else if (r === "Expands beyond your college") {
      chips.set("c:other", { key: "c:other", label: you ? "Another college" : "Different college", kind: "college" });
    } else {
      chips.set(`r:${r}`, { key: `r:${r}`, label: r, kind: "topic" });
    }
  }
  return Array.from(chips.values());
}

/** The same reasons as one readable line, e.g. "Aging & Alzheimer's · down syndrome · your college". */
export function plainReasons(reasons: string[], you = true): string {
  return reasonChips(reasons, you)
    .filter((c) => c.kind !== "source")
    .map((c) => (c.kind === "college" ? c.label.toLowerCase() : c.label))
    .join(" · ");
}
