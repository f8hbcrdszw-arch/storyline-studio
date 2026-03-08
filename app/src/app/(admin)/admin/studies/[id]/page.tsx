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

const TYPE_LABELS: Record<string, string> = {
  VIDEO_DIAL: "Video Dial",
  MULTIPLE_CHOICE: "Multiple Choice",
  LIKERT: "Likert Scale",
  OPEN_TEXT: "Open Text",
  NUMERIC: "Numeric",
  AB_TEST: "A/B Test",
  RANKING: "Ranking",
  MATRIX: "Matrix",
  MULTI_ITEM_RATING: "Multi-Item Rating",
  SENTIMENT: "Sentiment",
  REACTION: "Reaction",
};

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
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 animate-in fade-in duration-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to studies
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
            <p className="section-label mb-3">Questions</p>
            <div className="border-t border-border">
              {study.questions.map((q, i) => (
                <Link
                  key={q.id}
                  href={`/admin/studies/${id}/edit?q=${q.id}`}
                  className="group flex items-center gap-3 border-b border-border py-2.5 px-2 hover:bg-accent/30 -mx-1 rounded-md"
                >
                  <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-foreground group-hover:text-primary truncate">
                    {q.title}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {TYPE_LABELS[q.type] || titleCase(q.type)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                    {titleCase(q.phase)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-150" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-16 text-center mt-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary/60">
                <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="font-medium text-foreground">No questions yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Start building your study
            </p>
            <Link href={`/admin/studies/${id}/edit`}>
              <Button>Add Questions</Button>
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
