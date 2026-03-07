import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { z } from "zod";

const createMediaItemSchema = z.object({
  questionId: z.string().uuid(),
  source: z.enum(["UPLOAD", "YOUTUBE"]),
  url: z.string().max(2000).optional().nullable(),
  youtubeId: z.string().max(20).optional().nullable(),
  filename: z.string().max(255).optional().nullable(),
  type: z.enum(["VIDEO", "IMAGE", "AUDIO"]),
  durationSecs: z.number().int().positive().optional().nullable(),
  thumbnailUrl: z.string().url().max(2000).optional().nullable(),
});

// POST /api/media-items — create a media item for a question
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const data = createMediaItemSchema.parse(body);

  // Verify question ownership through study
  const question = await prisma.question.findFirst({
    where: {
      id: data.questionId,
      study: { createdBy: auth.userId },
    },
    select: { id: true },
  });

  if (!question) {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 }
    );
  }

  const mediaItem = await prisma.mediaItem.create({
    data: {
      questionId: data.questionId,
      source: data.source,
      url: data.url,
      youtubeId: data.youtubeId,
      filename: data.filename,
      type: data.type,
      durationSecs: data.durationSecs,
      thumbnailUrl: data.thumbnailUrl,
    },
  });

  return NextResponse.json(mediaItem, { status: 201 });
});
