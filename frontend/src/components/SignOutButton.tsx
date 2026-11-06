"use client";

import { signOutOfDemo } from "@/app/account/actions";
import { clearSaved } from "@/lib/demoStore";

/** Ends the demo session and forgets Maya's edits and saved items in this browser. */
export default function SignOutButton({
  className = "px-3 py-1.5 rounded-md border border-line-strong bg-surface text-small font-medium hover:border-cherry hover:text-cherry",
}: {
  className?: string;
}) {
  return (
    <form action={signOutOfDemo} onSubmit={() => clearSaved()}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
