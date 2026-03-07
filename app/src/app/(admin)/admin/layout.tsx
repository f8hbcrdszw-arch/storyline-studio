import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-card p-6 flex flex-col">
        <div className="mb-8">
          <h2 className="font-display text-lg font-light text-foreground">
            Storyline Studio
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
        </div>
        <nav className="space-y-1 flex-1">
          <Link
            href="/admin/studies"
            className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Studies
          </Link>
        </nav>
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
