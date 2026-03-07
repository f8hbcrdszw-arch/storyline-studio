import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSignedReadUrl } from "@/lib/storage";
import { withErrorHandler } from "@/lib/api/error-handler";

// GET /api/media/[questionId] — session-validated media proxy
// Returns a fresh signed URL for the media associated with a question.
// Validates that the respondent has an active session for the study.
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ questionId: string }> }
  ) => {
    const { questionId } = await params;
    const respondentId = request.cookies.get("respondent_id")?.value;

    // Get the media item and its study
    const mediaItem = await prisma.mediaItem.findFirst({
      where: { questionId },
      select: {
        url: true,
        source: true,
        youtubeId: true,
        question: {
          select: { studyId: true },
        },
      },
    });

    if (!mediaItem || !mediaItem.url) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // For uploaded media, validate respondent session
    if (mediaItem.source === "UPLOAD") {
      if (!respondentId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Verify respondent has an active response for this study
      const response = await prisma.response.findUnique({
        where: {
          studyId_respondentId: {
            studyId: mediaItem.question.studyId,
            respondentId,
          },
        },
        select: { status: true },
      });

      if (!response || response.status === "SCREENED_OUT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Generate fresh signed URL
      const signedUrl = await createSignedReadUrl(mediaItem.url);
      return NextResponse.json({ url: signedUrl });
    }

    // YouTube media — return the YouTube ID directly
    return NextResponse.json({ youtubeId: mediaItem.youtubeId });
  }
);
