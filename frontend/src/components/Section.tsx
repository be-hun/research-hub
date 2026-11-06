import Link from "next/link";

export default function Section({
  id,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  // min-w-0: inside a grid, a section may shrink below its content's width instead of overflowing small phones.
  return (
    <section id={id} className={`scroll-mt-20 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 mb-5">
        <div className="min-w-0">
          <h2 className="text-h2 break-words">{title}</h2>
          {subtitle && <p className="text-small text-ink-3 mt-1">{subtitle}</p>}
        </div>
        {action && (
          <Link href={action.href} className="text-small font-medium text-cherry hover:underline underline-offset-2">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
