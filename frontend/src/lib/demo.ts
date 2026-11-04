import { cookies } from "next/headers";
import { cleanInterests } from "./profileLimits";
import type { CollegeId, ProfileInput } from "./types";

// Demo sign-in: there are no real accounts. A cookie switches the site into "signed in as Maya Patel" mode and a
// second cookie holds her current interests, so server-rendered pages can personalize without storing anything on
// the server. Saved items stay in the browser (demoStore.ts). Maya is synthetic: every page that shows her says so.
export const DEMO_COOKIE = "rc_demo";
export const DEMO_COOKIE_VALUE = "maya";
export const INTERESTS_COOKIE = "rc_demo_interests";
export const DEMO_MAX_AGE_SECONDS = 8 * 60 * 60;
export const DEMO_COLLEGE: CollegeId = "engineering";

/** Server components and actions only. */
export function isDemoSignedIn(): boolean {
  return cookies().get(DEMO_COOKIE)?.value === DEMO_COOKIE_VALUE;
}

/** Maya's current interests as the backend's ProfileInput, or null when nobody is signed in. */
export function demoProfileInput(): ProfileInput | null {
  if (!isDemoSignedIn()) return null;
  let stored: unknown = null;
  try {
    stored = JSON.parse(cookies().get(INTERESTS_COOKIE)?.value ?? "null");
  } catch {
    // A damaged cookie counts as no interests; signing in again restores the defaults.
  }
  return { college: DEMO_COLLEGE, ...cleanInterests(stored) };
}
