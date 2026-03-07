import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { aggregateQuestion } from "@/lib/aggregation";
import { prisma } from "@/lib/prisma";

// GET /api/studies/[id]/results/questions/[questionId] — per-question results
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
      },
      select: { id: true, type: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Parse segment filter from query params
    const segmentQId = request.nextUrl.searchParams.get("segmentQuestionId");
    const segmentValue = request.nextUrl.searchParams.get("segmentValue");
    const segmentFilter =
      segmentQId && segmentValue
        ? { questionId: segmentQId, value: segmentValue }
        : undefined;

    const result = await aggregateQuestion(
      questionId,
      question.type,
      id,
      segmentFilter
    );

    return NextResponse.json(result);
  }
);
