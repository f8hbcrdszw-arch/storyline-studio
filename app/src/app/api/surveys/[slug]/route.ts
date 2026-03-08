import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createSignedReadUrl } from "@/lib/storage";

// GET /api/surveys/[slug] — public endpoint to fetch study data for survey rendering
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
  ) => {
    const { slug } = await params;

    // Support lookup by slug or ID (preview uses study ID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const study = await prisma.study.findFirst({
      where: isUuid ? { OR: [{ slug }, { id: slug }] } : { slug },
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

    const isPreview = request.nextUrl.searchParams.get("preview") === "true";

    if (!isPreview && study.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This survey is not currently accepting responses" },
        { status: 410 }
      );
    }

    // Sign option image URLs (R2 keys → signed URLs)
    for (const q of study.questions) {
      for (const opt of q.options) {
        if (opt.imageUrl && !opt.imageUrl.startsWith("http")) {
          opt.imageUrl = await createSignedReadUrl(opt.imageUrl);
        }
      }
    }

    const res = NextResponse.json(study);
    // Study structure rarely changes mid-session — cache briefly
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    return res;
  }
);
