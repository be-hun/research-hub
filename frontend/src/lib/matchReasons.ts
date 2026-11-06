// Turn the backend's match reasons into short, plain-language parts. The wording the backend uses is fixed in
// `_score` in backend/app/compatibility.py; anything this file doesn't recognise is passed through unchanged.

// "fragment" is one word of a multi-word interest that matched on its own ("learning" from "machine learning"). It
// counts toward the score, so a breakdown can list it, but on its own it would misstate the interest.
export type ReasonChip = { key: string; label: string; kind: "topic" | "keyword" | "fragment" | "college" };

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length > 1);

/**
 * "Shares Aging & Alzheimer's", "Shares stored terms: alzheimer, down, syndrome", "Linked to the same college" become
 * deduplicated chips. Keywords are matched one word at a time, so `interestTerms` (the profile's keywords) is used
 * to put "down syndrome" back together. `you` picks "Your college" over "Same college".
 */
export function reasonChips(reasons: string[], interestTerms: string[] = [], you = true): ReasonChip[] {
  const chips = new Map<string, ReasonChip>();
  const shared = new Set<string>();
  for (const r of reasons) {
    if (r.startsWith("Shares stored terms:")) {
      r.slice("Shares stored terms:".length).split(",").map((w) => w.trim()).filter(Boolean).forEach((w) => shared.add(w));
    } else if (r.startsWith("Shares ")) {
      const label = r.slice("Shares ".length);
      chips.set(`t:${label}`, { key: `t:${label}`, label, kind: "topic" });
    } else if (r === "Linked to the same college") {
      chips.set("c:same", { key: "c:same", label: you ? "Your college" : "Same college", kind: "college" });
    } else if (r === "Expands beyond your college") {
      chips.set("c:other", { key: "c:other", label: you ? "Another college" : "Different college", kind: "college" });
    } else {
      chips.set(`r:${r}`, { key: `r:${r}`, label: r, kind: "topic" });
    }
  }
  for (const term of interestTerms) {
    const parts = words(term);
    if (parts.length > 1 && parts.every((p) => shared.has(p))) {
      parts.forEach((p) => shared.delete(p));
      chips.set(`k:${term}`, { key: `k:${term}`, label: term, kind: "keyword" });
    }
  }
  shared.forEach((w) => {
    const whole = interestTerms.find((t) => words(t).length > 1 && words(t).includes(w));
    chips.set(
      `k:${w}`,
      whole ? { key: `k:${w}`, label: `${w} (part of “${whole}”)`, kind: "fragment" } : { key: `k:${w}`, label: w, kind: "keyword" },
    );
  });
  return Array.from(chips.values());
}

/** The same reasons as one readable line, e.g. "Aging & Alzheimer's · down syndrome · your college". */
export function plainReasons(reasons: string[], interestTerms: string[] = [], you = true): string {
  return reasonChips(reasons, interestTerms, you)
    .filter((c) => c.kind !== "fragment")
    .map((c) => (c.kind === "college" ? c.label.toLowerCase() : c.label))
    .join(" · ");
}
