/** In-page section navigation that sticks under the site header. Plain anchors: works without JavaScript and
 *  scrolls horizontally on small screens instead of wrapping. */
export default function SectionTabs({ items, label }: { items: { id: string; label: string }[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-canvas/95 backdrop-blur border-b border-line"
    >
      <ul className="flex gap-1 overflow-x-auto text-small font-medium -mb-px">
        {items.map((i) => (
          <li key={i.id} className="shrink-0">
            <a
              href={`#${i.id}`}
              className="inline-block px-3 py-3 border-b-2 border-transparent text-ink-2 hover:text-ink hover:border-line-strong"
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
