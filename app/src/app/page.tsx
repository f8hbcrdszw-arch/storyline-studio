import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="font-display text-4xl font-light tracking-tight text-foreground">
        Storyline Studio
      </h1>
      <p className="mt-4 text-muted-foreground">
        Web survey platform with video dial testing
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/admin/studies"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
