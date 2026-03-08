import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import { Wordmark } from "@/components/ui/wordmark";
import { LayoutGrid } from "lucide-react";
import { MobileNav } from "./components/MobileNav";

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

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 relative flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/admin/studies" className="flex items-center">
            <Wordmark size="md" className="text-foreground" />
          </Link>
          <div className="hidden sm:block h-5 w-px bg-border" />
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/admin/studies"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-primary bg-primary/[0.08]"
            >
              <LayoutGrid className="w-4 h-4" />
              Studies
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {user.email}
          </p>
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
            {initials}
          </div>
          <MobileNav />
        </div>
      </header>
      <div className="h-[2px] bg-gradient-to-r from-storyline-blue via-storyline-blue/60 to-transparent" />
      <main className="flex-1 px-8 py-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </main>
    </div>
  );
}
