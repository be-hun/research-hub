import { cookies } from "next/headers";

// Demo sign-in: there are no real accounts. A cookie switches the site into "signed in as Maya Patel" mode, and
// everything Maya changes (interests, saved items) stays in this browser (see demoStore.ts). Nothing is stored on the
// server, and Maya is a synthetic researcher: every page that shows her says so.
export const DEMO_COOKIE = "rc_demo";
export const DEMO_COOKIE_VALUE = "maya";
export const DEMO_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Server components only. */
export function isDemoSignedIn(): boolean {
  return cookies().get(DEMO_COOKIE)?.value === DEMO_COOKIE_VALUE;
}
