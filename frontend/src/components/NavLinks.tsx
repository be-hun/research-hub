"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/search", label: "Search" },
  { href: "/topics", label: "Topics" },
  { href: "/researchers", label: "People" },
  { href: "/profile", label: "Demo profile" },
  { href: "/colleges", label: "Colleges" },
  { href: "/ask", label: "Ask" },
  { href: "/about", label: "About" },
];

/** Main navigation with the current section marked, for sighted users and screen readers alike. */
export default function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname() ?? "/";
  return (
    <>
      {NAV.map((item) => {
        const on = path === item.href || path.startsWith(`${item.href}/`);
        const base = mobile ? "block px-4 py-2.5 text-body" : "px-3 py-2 rounded-md";
        const state = on
          ? mobile
            ? "text-cherry font-semibold bg-cherry-tint"
            : "text-cherry bg-cherry-tint"
          : mobile
            ? "text-ink hover:bg-canvas"
            : "text-ink-2 hover:text-ink hover:bg-canvas";
        return (
          <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={`${base} ${state}`}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
