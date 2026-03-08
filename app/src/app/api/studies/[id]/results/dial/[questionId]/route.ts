import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { aggregateDialData, aggregateLightbulbs } from "@/lib/aggregation";
import { prisma } from "@/lib/prisma";

const SEGMENT_COLORS = [
  "#121C8A", // Storyline Blue
  "#ef4444", // Red
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#78716c", // Stone
];

// GET /api/studies/[id]/results/dial/[questionId] — aggregated dial data
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; questionId: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id, questionId } = await params;

    // Verify ownership and question belongs to study
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        studyId: id,
        study: { createdBy: auth.userId },
        type: "VIDEO_DIAL",
      },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const segmentQId = searchParams.get("segmentQuestionId");
    const compare = searchParams.get("compare") === "true";

    // ── Compare mode: multi-segment overlay ──────────────────────────────
    if (compare && segmentQId) {
      // Fetch screening question options for labels
      const segmentQuestion = await prisma.question.findFirst({
        where: { id: segmentQId, studyId: id },
        select: {
          options: { orderBy: { order: "asc" }, select: { label: true, value: true } },
        },
      });

      if (!segmentQuestion) {
        return NextResponse.json({ error: "Segment question not found" }, { status: 404 });
      }

      // Aggregate each segment + "All" in parallel
      const segmentPromises = segmentQuestion.options.map((opt) =>
        aggregateDialData(questionId, id, { questionId: segmentQId, value: opt.value })
      );

      const [allData, lightbulbs, ...segmentResults] = await Promise.all([
        aggregateDialData(questionId, id),
        aggregateLightbulbs(questionId, id),
        ...segmentPromises,
      ]);

      const segments = [
        { label: "All", color: "#9ca3af", data: allData, n: allData[0]?.n ?? 0 },
        ...segmentQuestion.options.map((opt, i) => ({
          label: opt.label,
          color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
          data: segmentResults[i],
          n: segmentResults[i][0]?.n ?? 0,
        })),
      ];

      return NextResponse.json({ segments, lightbulbs });
    }

    // ── Single-segment filter mode (existing behavior) ───────────────────
    const segmentValue = searchParams.get("segmentValue");
    const segmentFilter =
      segmentQId && segmentValue
        ? { questionId: segmentQId, value: segmentValue }
        : undefined;

    const [dialData, lightbulbs] = await Promise.all([
      aggregateDialData(questionId, id, segmentFilter),
      aggregateLightbulbs(questionId, id),
    ]);

    // Fetch annotations from answer values
    const answers = await prisma.answer.findMany({
      where: {
        questionId,
        response: { studyId: id, status: "COMPLETED" },
      },
      select: { value: true, answeredAt: true },
      orderBy: { answeredAt: "desc" },
    });

    const annotations: { text: string; answeredAt: Date }[] = [];
    for (const a of answers) {
      const val = a.value as Record<string, unknown>;
      const texts = val.annotations as string[] | undefined;
      if (texts?.length) {
        for (const text of texts) {
          if (text.trim()) {
            annotations.push({ text: text.trim(), answeredAt: a.answeredAt });
          }
        }
      }
    }

    return NextResponse.json({ dialData, lightbulbs, annotations });
  }
);
