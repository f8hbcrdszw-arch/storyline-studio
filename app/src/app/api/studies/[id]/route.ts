import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { updateStudySchema, VALID_TRANSITIONS } from "@/lib/schemas/study";

// GET /api/studies/[id] — get a single study
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const study = await prisma.study.findUnique({
      where: { id, createdBy: auth.userId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            options: { orderBy: { order: "asc" } },
            mediaItems: true,
          },
        },
        _count: { select: { responses: true } },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    return NextResponse.json(study);
  }
);

// PATCH /api/studies/[id] — update a study
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const data = updateStudySchema.parse(body);

    // Verify ownership
    const existing = await prisma.study.findUnique({
      where: { id, createdBy: auth.userId },
      select: { id: true, status: true, _count: { select: { responses: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${existing.status} to ${data.status}`,
          },
          { status: 400 }
        );
      }

      // Publishing requires at least one question
      if (data.status === "ACTIVE" && existing.status === "DRAFT") {
        const questionCount = await prisma.question.count({
          where: { studyId: id },
        });
        if (questionCount === 0) {
          return NextResponse.json(
            { error: "Cannot publish a study with no questions" },
            { status: 400 }
          );
        }
      }
    }

    // Lock metadata edits (title/description/settings) on non-draft studies with responses
    if (
      existing.status !== "DRAFT" &&
      existing._count.responses > 0 &&
      (data.title || data.description !== undefined || data.settings)
    ) {
      return NextResponse.json(
        { error: "Cannot edit study metadata while responses exist" },
        { status: 400 }
      );
    }

    const study = await prisma.study.update({
      where: { id },
      data,
    });

    return NextResponse.json(study);
  }
);

// DELETE /api/studies/[id] — delete a draft study
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const study = await prisma.study.findUnique({
      where: { id, createdBy: auth.userId },
      select: { status: true },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    if (study.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft studies can be deleted" },
        { status: 400 }
      );
    }

    await prisma.study.delete({ where: { id } });

    return NextResponse.json({ success: true });
  }
);
