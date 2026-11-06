// Turn the backend's match reasons into short, plain-language parts. The wording is fixed in `_reasons` in
// backend/app/compatibility.py; change both together. Anything this file doesn't recognise is passed through.

// "source" says how the shared topics were tagged (funder data or keywords). It belongs in a score breakdown, not
// in the chips, which say what the match is about.
export type ReasonChip = { key: string; label: string; kind: "topic" | "keyword" | "college" | "source" };

/**
 * The scoring recipe, as `_score` applies it, and the bands `band_for` sorts the points into. Every match leads with
 * its band; the points are the detail behind it.
 */
export const SCORE_PARTS = {
  topics: "up to 60 points: 24 per shared topic, less when the record's topic comes only from keywords",
  keywords: "up to 32 points: 2 to 12 per shared interest, more for rarer and multi-word ones",
  sameCollege: "+8 points",
  otherCollege: "+5 points for people outside your college",
  minimum: 12,
  bands: "Strong overlap is 40 points or more, Good overlap 25 to 39, Some overlap below 25",
};

/**
 * "Shares Aging & Alzheimer's, Computing & AI", "Shares stored terms: down syndrome, sensors", "Linked to the same
 * college" become deduplicated chips, one per topic. The backend matches interests as whole phrases, so each term is one chip. `you` picks
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
      // "Shares Computing & AI, Heart, lung & blood" names two topics. A topic name can contain a comma ("Heart, lung
      // & blood"), but every name starts with a capital letter and no word after a comma inside a name does.
      r.slice("Shares ".length)
        .split(/,\s+(?=[A-Z])/)
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((label) => chips.set(`t:${label}`, { key: `t:${label}`, label, kind: "topic" }));
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
