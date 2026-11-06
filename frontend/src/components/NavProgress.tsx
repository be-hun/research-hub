"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A thin bar along the top while the next page loads, so a click never looks ignored. It starts on a click on an
 * internal link to another page and stops when the URL changes.
 */
export default function NavProgress() {
  const path = usePathname();
  const query = useSearchParams()?.toString();
  const [loading, setLoading] = useState(false);

  useEffect(() => setLoading(false), [path, query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      const here = window.location;
      if (url.origin !== here.origin) return;
      if (url.pathname === here.pathname && url.search === here.search) return; // same page, maybe a #hash
      setLoading(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div aria-hidden="true" className="fixed top-0 inset-x-0 z-50 h-0.5 pointer-events-none">
      <div className={`h-full bg-cherry transition-[width,opacity] ease-out ${loading ? "w-4/5 opacity-100 duration-[2500ms]" : "w-0 opacity-0 duration-200"}`} />
    </div>
  );
}
