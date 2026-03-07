import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getStudyOverviewStats } from "@/lib/aggregation";
import { ResultsDashboard } from "./components/ResultsDashboard";

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
            select: { id: true, source: true, youtubeId: true },
          },
        },
      },
    },
  });

  if (!study) notFound();

  const stats = await getStudyOverviewStats(id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/studies/${id}`}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              &larr; Back to study
            </Link>
          </div>
          <h1 className="text-xl font-medium text-foreground mt-1">
            {study.title} — Results
          </h1>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Responses" value={stats.totalResponses} />
        <StatCard label="Completed" value={stats.completed} suffix={`(${stats.completionRate}%)`} />
        <StatCard label="Screened Out" value={stats.screenedOut} suffix={`(${stats.screenOutRate}%)`} />
        <StatCard
          label="Avg. Time"
          value={
            stats.avgCompletionTimeSecs
              ? formatDuration(stats.avgCompletionTimeSecs)
              : "—"
          }
        />
      </div>

      {/* Per-question results */}
      <ResultsDashboard studyId={id} questions={study.questions} />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-medium text-foreground mt-1">
        {value}
        {suffix && (
          <span className="text-sm text-muted-foreground ml-1">{suffix}</span>
        )}
      </p>
    </div>
  );
}

function formatDuration(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remaining = Math.round(secs % 60);
  if (mins === 0) return `${remaining}s`;
  return `${mins}m ${remaining}s`;
}
