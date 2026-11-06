// Limits for the demo account's interests. They mirror ProfileInput in backend/app/models.py, which rejects
// anything larger. Shared by the server actions (which enforce them) and the editor (which shows them).
export const MAX_TOPICS = 8;
export const MAX_TERMS = 12;
export const MAX_TERM_LENGTH = 40;

export interface Interests {
  topics: string[];
  terms: string[];
}

const unique = (values: string[]) => Array.from(new Set(values));

/** Keep only well-formed values, trimmed, de-duplicated and within the limits. */
export function cleanInterests(value: unknown): Interests {
  const v = (value ?? {}) as { topics?: unknown; terms?: unknown };
  const topics = Array.isArray(v.topics)
    ? unique(v.topics.filter((t): t is string => typeof t === "string" && /^[a-z0-9-]{1,60}$/.test(t))).slice(0, MAX_TOPICS)
    : [];
  const terms = Array.isArray(v.terms)
    ? unique(
        v.terms
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
          .filter((t) => t.length >= 1 && t.length <= MAX_TERM_LENGTH),
      ).slice(0, MAX_TERMS)
    : [];
  return { topics, terms };
}
