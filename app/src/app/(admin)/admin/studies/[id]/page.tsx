import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { StudyActions } from "./components/StudyActions";
import { OverflowMenu } from "./components/OverflowMenu";
import { EditableTitle } from "./components/EditableTitle";
import { StudyThemeSection } from "./components/StudyThemeSection";
import { DEFAULT_THEME, type SurveyTheme } from "@/lib/types/json-fields";
import { ArrowLeft, Pencil, BarChart3, Eye, ChevronRight } from "lucide-react";

import { TYPE_LABELS } from "@/lib/constants/editor";

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

  return (
    <div className="max-w-4xl">
      {/* Back link */}
      <Link
        href="/admin/studies"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground mb-6 transition-colors animate-in fade-in duration-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Studies
      </Link>

      {/* Header + metadata */}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 delay-75">
        <div className="flex items-start justify-between mb-1">
          <EditableTitle studyId={study.id} title={study.title} />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {study.questions.length > 0 && (
              <Link href={`/admin/studies/${id}/preview`}>
                <Button variant="outline" size="sm">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview
                </Button>
              </Link>
            )}
            <Link href={`/admin/studies/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            </Link>
            {study._count.responses > 0 && (
              <Link href={`/admin/studies/${id}/results`}>
                <Button variant="outline" size="sm">
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  Results
                </Button>
              </Link>
            )}
            <OverflowMenu studyId={study.id} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <StatusDot status={study.status} />
          <span className="text-muted-foreground/50">·</span>
          <span>{study.questions.length} {study.questions.length === 1 ? "question" : "questions"}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{study._count.responses} {study._count.responses === 1 ? "response" : "responses"}</span>
        </div>

        {study.description && (
          <p className="text-sm text-muted-foreground mb-6">{study.description}</p>
        )}
      </div>

      {/* Toolbar rows: controls + share */}
      <div className="animate-in fade-in duration-300 delay-150">
        <StudyActions
          studyId={study.id}
          status={study.status}
          slug={study.slug}
          questionCount={study.questions.length}
          responseCount={study._count.responses}
        />
      </div>

      {/* Appearance / Theme */}
      <div className="animate-in fade-in duration-300 delay-175">
        <StudyThemeSection
          studyId={study.id}
          initialTheme={(study.settings as Record<string, unknown>)?.theme as SurveyTheme ?? DEFAULT_THEME}
          settings={study.settings as Record<string, unknown>}
        />
      </div>

      {/* Questions */}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 delay-200">
        {study.questions.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Questions</p>
              <Link
                href={`/admin/studies/${id}/edit`}
                className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
              >
                Open editor &rarr;
              </Link>
            </div>
            <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
              {study.questions.map((q, i) => {
                const isFirst = i === 0;
                const isLast = i === study.questions.length - 1;
                return (
                  <Link
                    key={q.id}
                    href={`/admin/studies/${id}/edit?q=${q.id}`}
                    className={`group flex items-center gap-3 py-3 px-4 hover:bg-accent/30 transition-colors ${
                      !isLast ? "border-b border-border/40" : ""
                    }`}
                  >
                    {/* Spine node */}
                    <div className="relative shrink-0">
                      <div className="w-2 h-2 rounded-full border-[1.5px] border-border group-hover:border-primary/50 bg-background transition-colors" />
                      {/* Connecting line */}
                      {!isFirst && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-px h-3 bg-border/40" />
                      )}
                      {!isLast && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-3 bg-border/40" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/35 w-4 text-right tabular-nums font-mono shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-foreground group-hover:text-primary truncate transition-colors">
                      {q.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 shrink-0">
                      {TYPE_LABELS[q.type] || titleCase(q.type)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 p-16 text-center mt-8">
            {/* Empty spine illustration */}
            <div className="flex flex-col items-center gap-1.5 mb-6">
              <div className="w-4 h-4 rounded-full border-2 border-dashed border-primary/20 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-primary/15" />
              </div>
              <div className="w-px h-5 bg-gradient-to-b from-primary/10 to-border/15" />
              <div className="w-3 h-3 rounded-full border-2 border-dashed border-border/20" />
            </div>
            <p className="font-medium text-foreground text-sm">No questions yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-6">
              Start building your study
            </p>
            <Link href={`/admin/studies/${id}/edit`}>
              <Button size="sm" className="rounded-lg">Open Editor</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function titleCase(str: string): string {
  return str
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
