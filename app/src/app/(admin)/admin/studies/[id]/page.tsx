import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

import { StudyActions } from "./components/StudyActions";

export default async function StudyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const study = await prisma.study.findUnique({
    where: { id, createdBy: user.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, type: true, phase: true, order: true },
      },
      _count: { select: { responses: true } },
    },
  });

  if (!study) notFound();

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    DRAFT: "bg-yellow-100 text-yellow-800",
    PAUSED: "bg-orange-100 text-orange-800",
    CLOSED: "bg-red-100 text-red-800",
    ARCHIVED: "bg-gray-100 text-gray-800",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-foreground">{study.title}</h1>
          {study.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {study.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_COLORS[study.status] || STATUS_COLORS.ARCHIVED
              }`}
            >
              {study.status}
            </span>
            <span className="text-sm text-muted-foreground">
              {study.questions.length} questions · {study._count.responses}{" "}
              responses
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/studies/${id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit Study
          </Link>
        </div>
      </div>

      {/* Lifecycle actions */}
      <StudyActions
        studyId={study.id}
        status={study.status}
        slug={study.slug}
        questionCount={study.questions.length}
        responseCount={study._count.responses}
      />

      {study.questions.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Questions
          </h2>
          {study.questions.map((q, i) => (
            <div
              key={q.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <span className="text-xs text-muted-foreground w-6 text-right">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{q.title}</p>
                <p className="text-xs text-muted-foreground">
                  {q.phase} · {q.type.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No questions yet</p>
          <Link
            href={`/admin/studies/${id}/edit`}
            className="text-sm text-primary hover:underline mt-1 inline-block"
          >
            Start building your study
          </Link>
        </div>
      )}
    </div>
  );
}
