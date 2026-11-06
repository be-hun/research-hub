import Link from "next/link";

/**
 * One card on the account page, LinkedIn style: a white panel with its heading inside. `size="sm"` is for the
 * sidebar, `muted` for notes that sit back from the content.
 */
export default function ProfileCard({
  id,
  title,
  subtitle,
  action,
  footer,
  size = "md",
  muted = false,
  children,
  className = "",
}: {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Shown at the right of the heading, e.g. an edit button. */
  action?: React.ReactNode;
  /** A link row under the content, e.g. "See all". */
  footer?: React.ReactNode;
  size?: "md" | "sm";
  muted?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      className={`scroll-mt-20 min-w-0 rounded-xl border border-line overflow-hidden focus:outline-none ${
        muted ? "bg-canvas" : "bg-surface shadow-card"
      } ${className}`}
    >
      <div className={size === "sm" ? "p-4 sm:p-5" : "p-4 sm:p-6"}>
        <div className={`flex items-start justify-between gap-3 ${size === "sm" ? "mb-3" : "mb-4"}`}>
          <div className="min-w-0">
            <h2
              id={`${id}-title`}
              className={`break-words ${size === "sm" ? "text-h3" : "text-[22px] leading-[30px] tracking-[-0.01em]"}`}
            >
              {title}
            </h2>
            {subtitle && <p className="text-small text-ink-3 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
      {footer && <div className="border-t border-line">{footer}</div>}
    </section>
  );
}

/** The full-width link row at the bottom of a card ("See all 312 →"). */
export function CardFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-1 px-4 py-3 text-small font-semibold text-ink-2 hover:bg-canvas hover:text-cherry"
    >
      {children}
    </Link>
  );
}
