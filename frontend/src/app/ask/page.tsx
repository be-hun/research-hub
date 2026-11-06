import type { Metadata } from "next";
import Link from "next/link";
import AskWorkspace from "@/components/AskWorkspace";
import { demoProfileInput } from "@/lib/demo";

export const metadata: Metadata = { title: "Ask" };

// Questions written for Maya's starting interests (cardiac devices, sensors, machine learning).
const DEMO_SUGGESTIONS = [
  "Who could help with my cardiac sensor project?",
  "Which recruiting trials use devices or sensors for the heart?",
  "Who outside Engineering works on machine learning for health?",
  "Build me a team for a grant on machine learning in cardiovascular disease",
];

export default function AskPage({ searchParams }: { searchParams: { q?: string | string[]; c?: string | string[] } }) {
  const shared = [searchParams.q].flat()[0]?.trim().slice(0, 1000) ?? "";
  const saved = [searchParams.c].flat()[0]?.trim().slice(0, 100) ?? "";
  const profile = demoProfileInput();
  const intro = (
    <header className="mb-8">
      <h1 className="text-h1">Ask about Temple research</h1>
      <p className="text-lead text-ink-2 mt-2 print:hidden">
        Ask who works on something, or what is being studied. The assistant searches Temple&apos;s grants, trials and
        papers first, then answers only from what it found. If nothing matches, it says so.{" "}
        <Link href="/about#how-it-works" className="text-cherry underline underline-offset-2 text-body">
          How this works
        </Link>
      </p>
      {profile && (
        <p className="text-small text-ink-2 bg-cherry-tint border border-cherry/20 rounded-lg px-4 py-3 mt-4 print:hidden">
          <strong className="text-ink">Signed in as Maya (demo).</strong> The assistant also searches with your
          interests, so you can ask about &quot;my project&quot;.{" "}
          <Link href="/account" className="text-cherry underline underline-offset-2">
            Edit interests
          </Link>
        </p>
      )}
    </header>
  );
  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10">
      <AskWorkspace
        profile={profile}
        suggestions={profile ? DEMO_SUGGESTIONS : undefined}
        initialQuestion={shared}
        initialConversationId={saved}
        intro={intro}
      />
    </main>
  );
}
