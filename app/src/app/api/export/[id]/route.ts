import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { prisma } from "@/lib/prisma";

// GET /api/export/[id] — check export job status
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const job = await prisma.exportJob.findFirst({
      where: { id, createdBy: auth.userId },
      select: {
        id: true,
        studyId: true,
        type: true,
        status: true,
        resultUrl: true,
        createdAt: true,
        completedAt: true,
        error: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Export job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  }
);
