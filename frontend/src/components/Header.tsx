import Link from "next/link";
import { signInAsDemo } from "@/app/account/actions";
import { isDemoSignedIn } from "@/lib/demo";
import AccountMenu from "./AccountMenu";
import Icon from "./Icon";
import NavLinks from "./NavLinks";


function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="ResearchConnect home">
      <span className="w-8 h-8 rounded-md bg-cherry text-white flex items-center justify-center font-serif font-semibold text-lg">
        TU
      </span>
      <span className="font-serif text-h3 text-ink">ResearchConnect</span>
    </Link>
  );
}

export default function Header() {
  const signedIn = isDemoSignedIn();
  return (
    <header className="bg-surface border-b border-line sticky top-0 z-40">
      <div className="max-w-page mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
          <nav aria-label="Main" className="hidden lg:flex items-center gap-1 text-small font-medium">
            <NavLinks />
          </nav>
          <AccountMenu signedIn={signedIn} />
          {/* Mobile menu without client JavaScript */}
          <details className="lg:hidden relative">
            <summary className="list-none cursor-pointer p-2 rounded-md hover:bg-canvas" aria-label="Open menu">
              <Icon name="menu" size={24} />
            </summary>
            <nav aria-label="Main" className="absolute right-0 mt-2 w-48 bg-surface border border-line rounded-lg shadow-card py-2">
              <NavLinks mobile />
              <div className="border-t border-line mt-2 pt-2">
                {signedIn ? (
                  <Link href="/account" className="block px-4 py-2.5 text-body text-ink hover:bg-canvas">
                    My account <span className="text-tiny text-cherry">(demo)</span>
                  </Link>
                ) : (
                  <form action={signInAsDemo}>
                    <button type="submit" className="w-full text-left px-4 py-2.5 text-body text-cherry hover:bg-canvas">
                      Sign in as Maya (demo)
                    </button>
                  </form>
                )}
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
