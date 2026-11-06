"use client";

import { useSyncExternalStore } from "react";

// The demo account's saved items, kept only in this browser. (Interests live in a cookie so the server can
// personalize pages; see demo.ts.) Storage can be missing or blocked (private windows, cleared site data), so every
// access is guarded and the list also lives in memory for the current page.

export interface SavedItem {
  kind: "record" | "researcher";
  id: string;
  title: string;
  detail?: string;
}

const KEY = "rc_demo_saved";
const EMPTY: SavedItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: SavedItem[] = EMPTY;

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 400;

function parse(raw: string | null): SavedItem[] {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((s: SavedItem) => (s?.kind === "record" || s?.kind === "researcher") && isString(s.id) && isString(s.title))
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function read(): SavedItem[] {
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

function write(next: SavedItem[]) {
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

export function useSaved(): SavedItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleSaved(item: SavedItem) {
  const saved = read();
  const exists = saved.some((s) => s.kind === item.kind && s.id === item.id);
  write(exists ? saved.filter((s) => !(s.kind === item.kind && s.id === item.id)) : [item, ...saved]);
}

export function clearSaved() {
  cachedRaw = null;
  cached = EMPTY;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  listeners.forEach((fn) => fn());
}
