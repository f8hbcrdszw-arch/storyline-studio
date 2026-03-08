import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { configSchemaByType, type QuestionType } from "@/lib/schemas/question";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const batchOptionSchema = z.object({
  label: z.string().min(1).max(500),
  value: z.string().min(1).max(255),
  order: z.number().int().min(0),
  imageUrl: z.string().max(2000).optional().nullable(),
});

const batchQuestionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  prompt: z.string().nullable().optional(),
  phase: z.enum(["SCREENING", "PRE_BALLOT", "STIMULUS", "POST_BALLOT"]),
  order: z.number().int().min(0),
  required: z.boolean(),
  isScreening: z.boolean(),
  config: z.record(z.string(), z.unknown()).default({}),
  skipLogic: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  type: z.string(),
  options: z.array(batchOptionSchema).default([]),
  // mediaItems are not modified by the editor store — they go through MediaUploader
  mediaItems: z.array(z.unknown()).optional(),
});

const batchSaveSchema = z.object({
  studyId: z.string().uuid(),
  questions: z.array(batchQuestionSchema),
});

/**
 * PUT /api/questions/batch — bulk save all questions for a study.
 * Used by the autosave system to persist editor state.
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { studyId, questions } = batchSaveSchema.parse(body);

  // Verify study ownership
  const study = await prisma.study.findUnique({
    where: { id: studyId, createdBy: auth.userId },
    select: {
      id: true,
      status: true,
      _count: { select: { responses: true } },
    },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  if (study.status !== "DRAFT" && study._count.responses > 0) {
    return NextResponse.json(
      { error: "Cannot edit questions on a study with existing responses" },
      { status: 400 }
    );
  }

  // Validate type-specific configs
  for (const q of questions) {
    const configValidator = configSchemaByType[q.type as QuestionType];
    if (configValidator && q.config) {
      configValidator.parse(q.config);
    }
  }

  // Batch update in a single transaction
  await prisma.$transaction(async (tx) => {
    for (const q of questions) {
      // Update question fields
      await tx.question.update({
        where: { id: q.id },
        data: {
          title: q.title,
          prompt: q.prompt ?? null,
          phase: q.phase,
          order: q.order,
          required: q.required,
          isScreening: q.isScreening,
          config: q.config as Prisma.InputJsonValue,
          skipLogic:
            q.skipLogic === null
              ? Prisma.DbNull
              : q.skipLogic !== undefined
                ? (q.skipLogic as unknown as Prisma.InputJsonValue)
                : undefined,
        },
      });

      // Replace options
      await tx.questionOption.deleteMany({ where: { questionId: q.id } });
      if (q.options.length > 0) {
        await tx.questionOption.createMany({
          data: q.options.map((opt, i) => ({
            questionId: q.id,
            label: opt.label,
            value: opt.value,
            order: opt.order ?? i,
            imageUrl: opt.imageUrl ?? null,
          })),
        });
      }
    }
  });

  return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
});
