import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  updateQuestionSchema,
  configSchemaByType,
  questionOptionSchema,
} from "@/lib/schemas/question";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

// Helper to verify question ownership through study
async function getOwnedQuestion(questionId: string, userId: string) {
  return prisma.question.findFirst({
    where: {
      id: questionId,
      study: { createdBy: userId },
    },
    include: {
      study: {
        select: {
          status: true,
          _count: { select: { responses: true } },
        },
      },
    },
  });
}

// GET /api/questions/[id]
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const question = await prisma.question.findFirst({
      where: { id, study: { createdBy: auth.userId } },
      include: {
        options: { orderBy: { order: "asc" } },
        mediaItems: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(question);
  }
);

// PATCH /api/questions/[id]
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    // Handle options separately
    const { options, ...questionData } = body;
    const data = updateQuestionSchema.parse(questionData);

    const existing = await getOwnedQuestion(id, auth.userId);
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    if (
      existing.study.status !== "DRAFT" &&
      existing.study._count.responses > 0
    ) {
      return NextResponse.json(
        { error: "Cannot edit questions on a study with existing responses" },
        { status: 400 }
      );
    }

    // Validate type-specific config if provided
    const questionType = data.phase ? existing.type : existing.type;
    if (data.config) {
      const configValidator = configSchemaByType[questionType];
      if (configValidator) configValidator.parse(data.config);
    }

    const question = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.QuestionUpdateInput = {
        ...data,
        config: data.config
          ? (data.config as Prisma.InputJsonValue)
          : undefined,
        skipLogic: data.skipLogic === null
          ? Prisma.DbNull
          : data.skipLogic !== undefined
            ? (data.skipLogic as Prisma.InputJsonValue)
            : undefined,
      };

      await tx.question.update({
        where: { id },
        data: updateData,
      });

      // Replace options if provided
      if (options !== undefined) {
        const parsedOptions = z.array(questionOptionSchema).parse(options);
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        if (parsedOptions.length > 0) {
          await tx.questionOption.createMany({
            data: parsedOptions.map((opt, i) => ({
              questionId: id,
              label: opt.label,
              value: opt.value,
              order: opt.order ?? i,
              imageUrl: opt.imageUrl,
            })),
          });
        }
      }

      return tx.question.findUnique({
        where: { id },
        include: {
          options: { orderBy: { order: "asc" } },
          mediaItems: true,
        },
      });
    });

    return NextResponse.json(question);
  }
);

// DELETE /api/questions/[id]
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await getOwnedQuestion(id, auth.userId);
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    if (
      existing.study.status !== "DRAFT" &&
      existing.study._count.responses > 0
    ) {
      return NextResponse.json(
        { error: "Cannot delete questions on a study with existing responses" },
        { status: 400 }
      );
    }

    await prisma.question.delete({ where: { id } });

    return NextResponse.json({ success: true });
  }
);
