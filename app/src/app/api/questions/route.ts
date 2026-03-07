import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  createQuestionSchema,
  configSchemaByType,
} from "@/lib/schemas/question";
import type { Prisma } from "@/generated/prisma/client";

// POST /api/questions — create a new question
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const data = createQuestionSchema.parse(body);

  // Validate type-specific config
  const configValidator = configSchemaByType[data.type];
  if (configValidator && data.config) {
    configValidator.parse(data.config);
  }

  // Verify study ownership
  const study = await prisma.study.findUnique({
    where: { id: data.studyId, createdBy: auth.userId },
    select: { id: true, status: true, _count: { select: { responses: true } } },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  if (study.status !== "DRAFT" && study._count.responses > 0) {
    return NextResponse.json(
      { error: "Cannot add questions to a study with existing responses" },
      { status: 400 }
    );
  }

  // Get next order number
  const maxOrder = await prisma.question.aggregate({
    where: { studyId: data.studyId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  // Create question with options in a transaction
  const question = await prisma.$transaction(async (tx) => {
    const q = await tx.question.create({
      data: {
        studyId: data.studyId,
        phase: data.phase,
        type: data.type,
        order: nextOrder,
        title: data.title,
        prompt: data.prompt,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        required: data.required ?? true,
        isScreening: data.isScreening ?? false,
        skipLogic: (data.skipLogic ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    if (data.options && data.options.length > 0) {
      await tx.questionOption.createMany({
        data: data.options.map((opt, i) => ({
          questionId: q.id,
          label: opt.label,
          value: opt.value,
          order: opt.order ?? i,
          imageUrl: opt.imageUrl,
        })),
      });
    }

    return tx.question.findUnique({
      where: { id: q.id },
      include: {
        options: { orderBy: { order: "asc" } },
        mediaItems: true,
      },
    });
  });

  return NextResponse.json(question, { status: 201 });
});
