"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, DEMO_COOKIE_VALUE, DEMO_MAX_AGE_SECONDS } from "@/lib/demo";

export async function signInAsDemo() {
  cookies().set(DEMO_COOKIE, DEMO_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_MAX_AGE_SECONDS,
  });
  redirect("/account");
}

export async function signOutOfDemo() {
  cookies().delete(DEMO_COOKIE);
  redirect("/");
}
