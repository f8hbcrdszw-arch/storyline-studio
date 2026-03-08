export default function StudyDetailLoading() {
  return (
    <div className="max-w-4xl animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 rounded bg-muted mb-6" />

      {/* Header row */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-lg bg-muted" />
          <div className="h-9 w-20 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Toolbar rows */}
      <div className="h-10 rounded-lg bg-muted mb-3" />
      <div className="h-10 rounded-lg bg-muted mb-8" />

      {/* Question list */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted" />
            </div>
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
