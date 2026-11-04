"use client";

import { useSyncExternalStore } from "react";

// What the demo account changes, kept only in this browser. Storage can be missing or blocked (private windows,
// cleared site data), so every access is guarded and the state also lives in memory for the current page.

export const MAX_INTERESTS = 8; // matches ProfileInput.topics on the backend (issue #5)

export interface SavedItem {
  kind: "record" | "researcher";
  id: string;
  title: string;
  detail?: string;
}

export interface DemoState {
  /** Topic ids Maya follows; null means "her starting interests" from GET /api/demo-profile. */
  topics: string[] | null;
  saved: SavedItem[];
}

const KEY = "rc_demo_state";
const EMPTY: DemoState = { topics: null, saved: [] };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: DemoState = EMPTY;

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

function parse(raw: string | null): DemoState {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw);
    const topics = Array.isArray(value?.topics) ? value.topics.filter(isString).slice(0, MAX_INTERESTS) : null;
    const saved = Array.isArray(value?.saved)
      ? value.saved.filter(
          (s: SavedItem) => (s?.kind === "record" || s?.kind === "researcher") && isString(s.id) && isString(s.title),
        )
      : [];
    return { topics, saved };
  } catch {
    return EMPTY;
  }
}

function read(): DemoState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function write(next: DemoState) {
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cached = next;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Keep the in-memory copy; it lasts until the page reloads.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function setTopics(topics: string[] | null) {
  write({ ...read(), topics: topics && topics.slice(0, MAX_INTERESTS) });
}

export function toggleSaved(item: SavedItem) {
  const state = read();
  const exists = state.saved.some((s) => s.kind === item.kind && s.id === item.id);
  write({
    ...state,
    saved: exists ? state.saved.filter((s) => !(s.kind === item.kind && s.id === item.id)) : [item, ...state.saved],
  });
}

export function clearDemoState() {
  cachedRaw = null;
  cached = EMPTY;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  listeners.forEach((fn) => fn());
}
