import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createSignedReadUrl } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

// GET /api/admin-media/[questionId] — admin-authenticated media URL
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ questionId: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { questionId } = await params;

    const mediaItem = await prisma.mediaItem.findFirst({
      where: {
        questionId,
        question: { study: { createdBy: auth.userId } },
      },
      select: { url: true, source: true, youtubeId: true },
    });

    if (!mediaItem) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    if (mediaItem.source === "YOUTUBE") {
      return NextResponse.json({ youtubeId: mediaItem.youtubeId });
    }

    if (!mediaItem.url) {
      return NextResponse.json({ error: "No media URL" }, { status: 404 });
    }

    const signedUrl = await createSignedReadUrl(mediaItem.url);
    return NextResponse.json({ signedUrl });
  }
);
