import Icon from "@/components/Icon";
import type { IdentityConfidence } from "@/lib/types";

const LABELS: Record<IdentityConfidence, string> = {
  high: "Single-source identity",
  medium: "Name match within one source",
  low: "Name match across sources",
};

/** The one provenance note on a profile: how sure we are the records are one person, and that nobody confirmed it. */
export default function ConfidenceNotice({
  confidence,
  note,
  verified,
}: {
  confidence: IdentityConfidence;
  note: string;
  verified: boolean;
}) {
  return (
    <details className="group text-small text-ink-2 max-w-3xl">
      <summary className="list-none cursor-pointer inline-flex items-start gap-1.5 hover:text-ink">
        <Icon name="info" size={18} className="text-ink-3 mt-0.5" />
        <span>
          <span className="font-semibold">{LABELS[confidence]}</span>
          {" · "}
          {verified ? "Confirmed by the researcher" : "Not confirmed by the researcher"}
          <span className="text-cherry ml-1.5 underline underline-offset-2 group-open:hidden">What does this mean?</span>
        </span>
      </summary>
      <p className="mt-2 pl-6 text-ink-3">{note}</p>
    </details>
  );
}
