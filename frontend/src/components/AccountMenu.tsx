import Link from "next/link";
import { signInAsDemo } from "@/app/account/actions";

/** Header control for the demo account: a sign-in button, or Maya's badge once signed in. */
export default function AccountMenu({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) {
    return (
      // Below 400px there is no room beside the logo; the mobile menu has its own sign-in entry.
      <form action={signInAsDemo} className="hidden min-[400px]:block">
        <button
          type="submit"
          className="whitespace-nowrap px-3 py-1.5 rounded-md border border-cherry/40 text-cherry text-small font-medium hover:bg-cherry-tint"
        >
          <span className="sm:hidden">Try demo</span>
          <span className="hidden sm:inline">
            Sign in as Maya <span className="text-ink-3 font-normal">(demo)</span>
          </span>
        </button>
      </form>
    );
  }
  return (
    <Link
      href="/account"
      className="flex items-center gap-2 rounded-full pl-1 pr-1 sm:pr-3 py-1 hover:bg-canvas"
      aria-label="My account: Maya Patel, synthetic demo account"
    >
      <span className="w-8 h-8 rounded-full bg-cherry-tint text-cherry font-serif font-semibold text-small flex items-center justify-center" aria-hidden="true">
        MP
      </span>
      <span className="hidden sm:flex flex-col leading-tight" aria-hidden="true">
        <span className="text-small font-medium text-ink">Maya Patel</span>
        <span className="text-tiny text-cherry">Demo account · synthetic</span>
      </span>
    </Link>
  );
}
