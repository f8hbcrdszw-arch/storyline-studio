export default function SurveyLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-pulse space-y-6 w-full max-w-xl px-4">
        <div className="h-6 w-48 rounded bg-muted mx-auto" />
        <div className="h-1 w-full rounded bg-muted" />
        <div className="space-y-4 pt-8">
          <div className="h-5 w-3/4 rounded bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
