export default function Loading() {
  return (
    <main className="max-w-page mx-auto px-4 sm:px-6 pt-10" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-2/3 max-w-xl rounded bg-line" />
        <div className="h-5 w-1/2 max-w-md rounded bg-line" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-line" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-line" />
      </div>
    </main>
  );
}
