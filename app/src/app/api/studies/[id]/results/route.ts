import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getStudyOverviewStats } from "@/lib/aggregation";
import { prisma } from "@/lib/prisma";

// GET /api/studies/[id]/results — study results overview
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Verify ownership
    const study = await prisma.study.findUnique({
      where: { id, createdBy: auth.userId },
      select: { id: true },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    const stats = await getStudyOverviewStats(id);
    return NextResponse.json(stats);
  }
);
