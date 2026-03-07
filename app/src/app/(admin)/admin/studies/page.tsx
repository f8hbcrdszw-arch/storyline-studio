import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatusDot } from "@/components/ui/status-dot";
import { ChevronRight } from "lucide-react";

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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Study
        </Link>
      </div>

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
        <div className="border-t border-border animate-in fade-in duration-300 delay-100">
          {studies.map((study) => (
            <Link
              key={study.id}
              href={`/admin/studies/${study.id}`}
              className="group flex items-center justify-between border-b border-border py-3 px-2 hover:bg-accent/30 -mx-1 rounded-md"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                  {study.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {study._count.questions} {study._count.questions === 1 ? "question" : "questions"} · {study._count.responses} {study._count.responses === 1 ? "response" : "responses"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <StatusDot status={study.status} />
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-150" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
