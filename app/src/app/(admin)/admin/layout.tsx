export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-border bg-card p-6">
        <div className="mb-8">
          <h2 className="font-display text-lg font-light text-foreground">
            Storyline Studio
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
        </div>
        <nav className="space-y-1">
          <a
            href="/admin/studies"
            className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Studies
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
