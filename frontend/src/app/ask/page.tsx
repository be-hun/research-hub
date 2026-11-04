import type { Metadata } from "next";
import Link from "next/link";
import AssistantChat from "@/components/AssistantChat";
import { demoProfileInput } from "@/lib/demo";

export const metadata: Metadata = { title: "Ask" };

// Questions written for Maya's starting interests (cardiac devices, sensors, machine learning).
const DEMO_SUGGESTIONS = [
  "Who could help with my cardiac sensor project?",
  "Which recruiting trials use devices or sensors for the heart?",
  "Who outside Engineering works on machine learning for health?",
];

export default function AskPage() {
  const profile = demoProfileInput();
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
      <header className="mb-8">
        <h1 className="text-h1">Ask about Temple research</h1>
        <p className="text-lead text-ink-2 mt-2">
          Ask who works on something, or what is being studied. The assistant searches Temple&apos;s grants, trials and
          papers first, then answers only from what it found. If nothing matches, it says so.{" "}
          <Link href="/about#how-it-works" className="text-cherry underline underline-offset-2 text-body">
            How this works
          </Link>
        </p>
        {profile && (
          <p className="text-small text-ink-2 bg-cherry-tint border border-cherry/20 rounded-lg px-4 py-3 mt-4">
            <strong className="text-ink">Signed in as Maya (demo).</strong> The assistant also searches with your
            interests, so you can ask about &quot;my project&quot;.{" "}
            <Link href="/account" className="text-cherry underline underline-offset-2">
              Edit interests
            </Link>
          </p>
        )}
      </header>
      <AssistantChat profile={profile} suggestions={profile ? DEMO_SUGGESTIONS : undefined} />
    </main>
  );
}
