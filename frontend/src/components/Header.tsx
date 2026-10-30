import Link from "next/link";
import Icon from "./Icon";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/search", label: "Search" },
  { href: "/topics", label: "Topics" },
  { href: "/ask", label: "Ask" },
  { href: "/about", label: "About" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="ResearchConnect home">
      <span className="w-8 h-8 rounded-md bg-cherry text-white flex items-center justify-center font-serif font-semibold text-lg">
        T
      </span>
      <span className="font-serif text-h3 text-ink">ResearchConnect</span>
    </Link>
  );
}

export default function Header() {
  return (
    <header className="bg-surface border-b border-line sticky top-0 z-40">
      <div className="max-w-page mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden md:flex items-center gap-1 text-small font-medium">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="px-3 py-2 rounded-md text-ink-2 hover:text-ink hover:bg-canvas">
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Mobile menu without client JavaScript */}
        <details className="md:hidden relative">
          <summary className="list-none cursor-pointer p-2 rounded-md hover:bg-canvas" aria-label="Open menu">
            <Icon name="menu" size={24} />
          </summary>
          <nav aria-label="Main" className="absolute right-0 mt-2 w-48 bg-surface border border-line rounded-lg shadow-card py-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block px-4 py-2.5 text-body text-ink hover:bg-canvas">
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
