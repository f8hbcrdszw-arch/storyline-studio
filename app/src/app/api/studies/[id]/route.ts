import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { updateStudySchema } from "@/lib/schemas/study";

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
