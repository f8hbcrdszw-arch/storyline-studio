import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { withErrorHandler } from "@/lib/api/error-handler";
import { rateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { createResponseSchema } from "@/lib/schemas/answer";
import { randomUUID } from "crypto";

// POST /api/responses — create a new response (or resume existing)
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate limit: 1 new response per minute per IP
  const limited = rateLimit(request, "createResponse", RATE_LIMITS.createResponse);
  if (limited) return limited;

  const body = await request.json();
  const { studyId } = createResponseSchema.parse(body);

  // Verify study is active
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, status: true },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  if (study.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This survey is not currently accepting responses" },
      { status: 410 }
    );
  }

  // Check for existing respondent cookie
  const existingRespondentId = request.cookies.get("respondent_id")?.value;

  // If respondent already has an in-progress response for this study, resume it
  if (existingRespondentId) {
    const existing = await prisma.response.findUnique({
      where: {
        studyId_respondentId: {
          studyId,
          respondentId: existingRespondentId,
        },
      },
      include: {
        answers: {
          select: {
            questionId: true,
            value: true,
            answeredAt: true,
          },
        },
      },
    });

    if (existing) {
      return NextResponse.json(existing);
    }
  }

  // Create new respondent and response
  const respondentId = existingRespondentId || randomUUID();

  const response = await prisma.response.create({
    data: {
      studyId,
      respondentId,
      metadata: {
        userAgent: request.headers.get("user-agent") || undefined,
        referrer: request.headers.get("referer") || undefined,
      } as Prisma.InputJsonValue,
    },
    include: {
      answers: {
        select: {
          questionId: true,
          value: true,
          answeredAt: true,
        },
      },
    },
  });

  // Set respondent cookie (HttpOnly, 30-day expiry)
  const res = NextResponse.json(response, { status: 201 });
  res.cookies.set("respondent_id", respondentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return res;
});
