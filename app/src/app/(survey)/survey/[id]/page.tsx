export default async function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <p className="text-muted-foreground">Survey: {id}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Survey runner will be implemented in Phase 3.
      </p>
    </div>
  );
}
