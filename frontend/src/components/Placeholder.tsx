export default function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <main className="max-w-[1440px] mx-auto px-margin py-space-xl">
      <h1 className="font-headline text-headline-lg">{title}</h1>
      <p className="text-body-md text-tertiary mt-2">{note ?? "Not built yet."}</p>
    </main>
  );
}
