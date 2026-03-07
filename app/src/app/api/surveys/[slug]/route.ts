import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/api/error-handler";

// GET /api/surveys/[slug] — public endpoint to fetch study data for survey rendering
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
  ) => {
    const { slug } = await params;

    const study = await prisma.study.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        settings: true,
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            type: true,
            phase: true,
            order: true,
            title: true,
            prompt: true,
            config: true,
            required: true,
            isScreening: true,
            skipLogic: true,
            options: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                label: true,
                value: true,
                order: true,
                imageUrl: true,
              },
            },
            mediaItems: {
              select: {
                id: true,
                source: true,
                youtubeId: true,
                type: true,
                durationSecs: true,
                thumbnailUrl: true,
                // url is not exposed — use media proxy endpoint
              },
            },
          },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (study.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This survey is not currently accepting responses" },
        { status: 410 }
      );
    }

    return NextResponse.json(study);
  }
);
