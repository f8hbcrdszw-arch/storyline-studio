export default function EditorLoading() {
  return (
    <div className="max-w-4xl animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 rounded bg-muted mb-6" />

      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-muted" />
        ))}
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-5 w-56 rounded bg-muted" />
              <div className="ml-auto h-5 w-20 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
