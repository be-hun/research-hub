/**
 * A Material Symbols icon. The name must be in ICONS in app/layout.tsx, which cuts the font down to the icons used.
 * The box is fixed to one square, so the ligature name never takes up room (or shows) before the font arrives.
 */
export default function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined shrink-0 overflow-hidden ${className}`}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
