import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { prisma } from "@/lib/prisma";

// DELETE /api/media-items/[id] — remove a media item
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Verify ownership through question → study → createdBy
    const item = await prisma.mediaItem.findFirst({
      where: {
        id,
        question: { study: { createdBy: auth.userId } },
      },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Media item not found" },
        { status: 404 }
      );
    }

    await prisma.mediaItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  }
);
