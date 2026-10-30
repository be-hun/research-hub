import AssistantChat from "@/components/AssistantChat";

export default function AssistantPage() {
  return (
    <main className="max-w-[900px] mx-auto px-margin py-6">
      <div className="mb-4">
        <h1 className="font-headline text-headline-md">ResearchConnect Assistant</h1>
        <p className="text-body-sm text-tertiary">
          Answers come only from ResearchConnect records. Check the source before relying on them.
        </p>
      </div>
      <AssistantChat />
    </main>
  );
}
