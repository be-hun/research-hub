import Link from "next/link";
import Icon from "./Icon";

const NAV = [
  { href: "/", label: "Discover" },
  { href: "/pathways", label: "Pathways" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/matches", label: "Matches" },
  { href: "/researchers/r-rivera", label: "My Profile" },
];

export default function Header() {
  return (
    <header className="bg-primary-container text-on-primary sticky top-0 z-50 shadow-sm">
      <div className="w-full px-margin mx-auto max-w-[1440px] flex justify-between items-center h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-headline-md font-headline font-bold tracking-tight">
            <span className="w-8 h-8 rounded bg-surface-container-lowest text-primary-container flex items-center justify-center font-bold text-lg">
              T
            </span>
            <span>ResearchConnect</span>
          </Link>
          <nav aria-label="Main" className="hidden md:flex items-center gap-6 text-label-lg">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-primary-fixed hover:text-on-primary pb-1 transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/assistant"
          className="bg-secondary hover:bg-[#243EA8] text-white px-3.5 py-1.5 rounded-lg text-label-md flex items-center gap-1.5 transition-colors"
        >
          <Icon name="auto_awesome" size={18} />
          <span>Ask ResearchConnect</span>
        </Link>
      </div>
    </header>
  );
}
