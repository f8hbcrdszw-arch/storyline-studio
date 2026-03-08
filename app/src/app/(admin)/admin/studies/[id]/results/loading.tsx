export default function ResultsLoading() {
  return (
    <div className="max-w-6xl animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 rounded bg-muted mb-6" />

      {/* Header */}
      <div className="h-7 w-56 rounded bg-muted mb-2" />
      <div className="h-4 w-36 rounded bg-muted mb-6" />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-6 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted" />
          ))}
        </div>
        {/* Content */}
        <div className="rounded-xl border border-border p-8 space-y-4">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="space-y-2 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
