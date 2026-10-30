import Icon from "./Icon";

export default function Card({
  title,
  icon,
  aside,
  children,
}: {
  title?: string;
  icon?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-space-lg">
      {title && (
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="font-headline text-headline-sm flex items-center gap-2">
            {icon && <Icon name={icon} size={22} className="text-primary" />}
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
