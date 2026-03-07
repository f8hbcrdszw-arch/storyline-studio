import Link from "next/link";

export default function StudyNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          Study not found
        </h2>
        <p className="text-sm text-muted-foreground">
          This study doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link
          href="/admin/studies"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to studies
        </Link>
      </div>
    </div>
  );
}
