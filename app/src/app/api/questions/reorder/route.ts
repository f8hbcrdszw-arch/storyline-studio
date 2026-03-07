import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { reorderQuestionsSchema } from "@/lib/schemas/question";

// POST /api/questions/reorder — batch reorder questions
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { studyId, questionIds } = reorderQuestionsSchema.parse(body);

  // Verify study ownership
  const study = await prisma.study.findUnique({
    where: { id: studyId, createdBy: auth.userId },
    select: { id: true, status: true, _count: { select: { responses: true } } },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  if (study.status !== "DRAFT" && study._count.responses > 0) {
    return NextResponse.json(
      { error: "Cannot reorder questions on a study with existing responses" },
      { status: 400 }
    );
  }

  // Verify all question IDs belong to this study
  const existingQuestions = await prisma.question.findMany({
    where: { studyId },
    select: { id: true },
  });
  const existingIds = new Set(existingQuestions.map((q) => q.id));

  for (const qId of questionIds) {
    if (!existingIds.has(qId)) {
      return NextResponse.json(
        { error: `Question ${qId} does not belong to this study` },
        { status: 400 }
      );
    }
  }

  // Update orders in a transaction
  // Use a temporary negative offset to avoid unique constraint violations
  await prisma.$transaction(async (tx) => {
    // First pass: set all to negative values to avoid conflicts
    for (let i = 0; i < questionIds.length; i++) {
      await tx.question.update({
        where: { id: questionIds[i] },
        data: { order: -(i + 1) },
      });
    }
    // Second pass: set to final values
    for (let i = 0; i < questionIds.length; i++) {
      await tx.question.update({
        where: { id: questionIds[i] },
        data: { order: i },
      });
    }
  });

  return NextResponse.json({ success: true });
});
