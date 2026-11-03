import type { Metadata } from "next";
import Link from "next/link";
import AssistantChat from "@/components/AssistantChat";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
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
      </header>
      <AssistantChat />
    </main>
  );
}
