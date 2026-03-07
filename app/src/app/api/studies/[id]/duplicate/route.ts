import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// POST /api/studies/[id]/duplicate — clone a study as a new draft
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Fetch the full study with questions, options, and media
    const source = await prisma.study.findFirst({
      where: { id, createdBy: auth.userId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            options: { orderBy: { order: "asc" } },
            mediaItems: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // Create the duplicate in a transaction
    const duplicate = await prisma.$transaction(async (tx) => {
      // Create new study
      const newStudy = await tx.study.create({
        data: {
          title: `${source.title} (Copy)`,
          description: source.description,
          settings: source.settings ?? {},
          createdBy: auth.userId,
          status: "DRAFT",
        },
      });

      // Track old question ID → new question ID for skip logic references
      const questionIdMap = new Map<string, string>();

      // Clone questions with options and media
      for (const q of source.questions) {
        const newQuestion = await tx.question.create({
          data: {
            studyId: newStudy.id,
            title: q.title,
            type: q.type,
            phase: q.phase,
            order: q.order,
            config: q.config ?? {},
            isScreening: q.isScreening,
            options: {
              create: q.options.map((opt) => ({
                label: opt.label,
                value: opt.value,
                order: opt.order,
              })),
            },
            mediaItems: {
              create: q.mediaItems.map((m) => ({
                source: m.source,
                type: m.type,
                url: m.url,
                youtubeId: m.youtubeId,
                filename: m.filename,
                durationSecs: m.durationSecs,
                thumbnailUrl: m.thumbnailUrl,
              })),
            },
          },
        });

        questionIdMap.set(q.id, newQuestion.id);
      }

      // Update skip logic JSON with new question IDs
      for (const q of source.questions) {
        const newQuestionId = questionIdMap.get(q.id);
        if (!newQuestionId || !q.skipLogic) continue;

        const rules = q.skipLogic as Array<Record<string, unknown>>;
        if (!Array.isArray(rules) || rules.length === 0) continue;

        const updatedRules = rules
          .map((rule) => {
            const newConditionId = questionIdMap.get(
              rule.conditionQuestionId as string
            );
            const newSkipToId = rule.skipToQuestionId
              ? questionIdMap.get(rule.skipToQuestionId as string)
              : null;

            if (!newConditionId) return null;

            return {
              ...rule,
              conditionQuestionId: newConditionId,
              skipToQuestionId: newSkipToId || null,
            };
          })
          .filter(Boolean);

        if (updatedRules.length > 0) {
          await tx.question.update({
            where: { id: newQuestionId },
            data: { skipLogic: updatedRules as unknown as Prisma.InputJsonValue },
          });
        }
      }

      return newStudy;
    });

    return NextResponse.json(duplicate, { status: 201 });
  }
);
