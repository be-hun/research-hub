/** Simple line illustrations, decorative only (aria-hidden). Stroke colors are passed in so a college page can
 *  use its own color; everything else is warm gray. No faces or people likenesses: they stand for records. */

type Variant = "people" | "college" | "empty" | "profile";

export default function Illustration({
  variant,
  accent = "#A41E35",
  className = "",
}: {
  variant: Variant;
  accent?: string;
  className?: string;
}) {
  const gray = "#D3D0C8";
  const ink = "#6B6862";
  const common = { fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true" focusable="false">
      <circle cx="160" cy="100" r="92" fill={accent} opacity="0.06" />
      {variant === "people" && (
        <g {...common}>
          {/* three figures linked by shared records */}
          <circle cx="92" cy="74" r="16" stroke={ink} />
          <path d="M64 138c4-22 16-34 28-34s24 12 28 34" stroke={ink} />
          <circle cx="228" cy="74" r="16" stroke={ink} />
          <path d="M200 138c4-22 16-34 28-34s24 12 28 34" stroke={ink} />
          <circle cx="160" cy="58" r="18" stroke={accent} />
          <path d="M128 132c5-25 18-38 32-38s27 13 32 38" stroke={accent} />
          <path d="M112 92l26-14M208 92l-26-14" stroke={gray} strokeDasharray="4 6" />
          <rect x="132" y="146" width="56" height="34" rx="4" stroke={gray} />
          <path d="M142 158h36M142 168h24" stroke={gray} />
        </g>
      )}
      {variant === "college" && (
        <g {...common}>
          {/* a building with rising bars beside it */}
          <path d="M70 168h180" stroke={ink} />
          <path d="M84 168V94l56-28 56 28v74" stroke={ink} />
          <path d="M100 168v-52M124 168v-52M156 168v-52M180 168v-52" stroke={gray} />
          <path d="M92 104h96" stroke={ink} />
          <circle cx="140" cy="82" r="6" stroke={accent} />
          <path d="M214 168v-30M230 168v-48M246 168v-66" stroke={accent} strokeWidth="8" />
        </g>
      )}
      {variant === "profile" && (
        <g {...common}>
          {/* a document stack with a timeline */}
          <rect x="96" y="52" width="92" height="116" rx="6" stroke={gray} />
          <rect x="112" y="40" width="92" height="116" rx="6" stroke={ink} fill="#FFFFFF" />
          <path d="M128 66h60M128 80h44M128 94h52" stroke={gray} />
          <path d="M128 128h12v-14h12v-10h12v24h12" stroke={accent} />
          <circle cx="232" cy="80" r="5" stroke={accent} />
          <circle cx="232" cy="112" r="5" stroke={ink} />
          <circle cx="232" cy="144" r="5" stroke={ink} />
          <path d="M232 85v22M232 117v22" stroke={gray} />
        </g>
      )}
      {variant === "empty" && (
        <g {...common}>
          {/* a magnifier over an empty page */}
          <rect x="104" y="44" width="96" height="120" rx="6" stroke={gray} />
          <path d="M120 70h52M120 84h36" stroke={gray} strokeDasharray="4 6" />
          <circle cx="186" cy="118" r="26" stroke={accent} />
          <path d="M205 137l22 22" stroke={accent} strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}
