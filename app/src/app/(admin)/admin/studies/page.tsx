import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StudyList } from "./components/StudyList";

export default async function StudiesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const studies = await prisma.study.findMany({
    where: { createdBy: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { responses: true, questions: true } },
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div>
          <h1>Studies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your survey studies
          </p>
        </div>
        <Link
          href="/admin/studies/new"
          className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/30 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform duration-300 group-hover:rotate-90">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Study
        </Link>
      </div>

      {studies.length > 0 && (() => {
        const active = studies.filter((s) => s.status === "ACTIVE").length;
        const closed = studies.filter((s) => s.status === "CLOSED").length;
        const totalResponses = studies.reduce((sum, s) => sum + s._count.responses, 0);
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-in fade-in slide-in-from-bottom-1 duration-300 delay-75">
            {[
              { label: "Active", value: active, accent: "text-emerald-500" },
              { label: "Closed", value: closed, accent: "text-amber-500" },
              { label: "Total Studies", value: studies.length, accent: "text-foreground" },
              { label: "Responses", value: totalResponses, accent: "text-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-semibold mt-0.5 ${stat.accent}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {studies.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-16 text-center animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary/60">
              <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="font-medium text-foreground">No studies yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first study to get started
          </p>
          <Link
            href="/admin/studies/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Study
          </Link>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300 delay-100">
          <StudyList studies={studies} />
        </div>
      )}
    </div>
  );
}
