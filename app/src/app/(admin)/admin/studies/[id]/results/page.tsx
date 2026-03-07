import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getStudyOverviewStats } from "@/lib/aggregation";
import { ResultsDashboard } from "./components/ResultsDashboard";
import { ExportButton } from "./components/ExportButton";
import { ArrowLeft } from "lucide-react";

export default async function StudyResultsPage({
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
        select: {
          id: true,
          title: true,
          type: true,
          phase: true,
          order: true,
          isScreening: true,
          options: {
            orderBy: { order: "asc" },
            select: { id: true, label: true, value: true },
          },
          mediaItems: {
            select: { id: true, source: true, youtubeId: true, url: true },
          },
        },
      },
    },
  });

  if (!study) notFound();

  const stats = await getStudyOverviewStats(id);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div>
          <Link
            href={`/admin/studies/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to study
          </Link>
          <h1 className="mt-1">{study.title} — Results</h1>
        </div>
        <ExportButton studyId={id} />
      </div>

      {/* Inline stats row */}
      <div className="toolbar-row mb-8 animate-in fade-in duration-300 delay-75">
        <StatInline label={stats.totalResponses === 1 ? "response" : "responses"} value={stats.totalResponses} />
        <StatInline label="completed" value={stats.completed} suffix={`${stats.completionRate}%`} accent="emerald" />
        <StatInline label="screened out" value={stats.screenedOut} suffix={`${stats.screenOutRate}%`} accent="amber" />
        <StatInline
          label="avg time"
          value={
            stats.avgCompletionTimeSecs
              ? formatDuration(stats.avgCompletionTimeSecs)
              : "—"
          }
        />
      </div>

      {/* Per-question results */}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 delay-150">
        <ResultsDashboard studyId={id} questions={study.questions} />
      </div>
    </div>
  );
}

function StatInline({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: "emerald" | "amber";
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xl font-medium text-foreground tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
      {suffix && (
        <span
          className={`text-xs font-medium ${
            accent === "emerald"
              ? "text-emerald-600"
              : accent === "amber"
                ? "text-amber-600"
                : "text-muted-foreground"
          }`}
        >
          {suffix}
        </span>
      )}
    </span>
  );
}

function formatDuration(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remaining = Math.round(secs % 60);
  if (mins === 0) return `${remaining}s`;
  return `${mins}m ${remaining}s`;
}
