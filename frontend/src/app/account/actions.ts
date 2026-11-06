"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDemoProfile } from "@/lib/api";
import { DEMO_COOKIE, DEMO_COOKIE_VALUE, DEMO_MAX_AGE_SECONDS, INTERESTS_COOKIE, isDemoSignedIn } from "@/lib/demo";
import { cleanInterests, type Interests } from "@/lib/profileLimits";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DEMO_MAX_AGE_SECONDS,
};

function writeInterests(interests: Interests) {
  cookies().set(INTERESTS_COOKIE, JSON.stringify(cleanInterests(interests)), cookieOptions);
}

async function startingInterests(): Promise<Interests> {
  const profile = await getDemoProfile();
  return { topics: profile.interests.map((t) => t.id), terms: profile.terms };
}

export async function signInAsDemo() {
  const interests = await startingInterests();
  cookies().set(DEMO_COOKIE, DEMO_COOKIE_VALUE, cookieOptions);
  writeInterests(interests);
  redirect("/account");
}

export async function signOutOfDemo() {
  cookies().delete(DEMO_COOKIE);
  cookies().delete(INTERESTS_COOKIE);
  redirect("/");
}

export async function saveInterests(interests: Interests) {
  if (!isDemoSignedIn()) return;
  writeInterests(interests);
  revalidatePath("/", "layout");
}

export async function resetInterests() {
  if (!isDemoSignedIn()) return;
  writeInterests(await startingInterests());
  revalidatePath("/", "layout");
}
