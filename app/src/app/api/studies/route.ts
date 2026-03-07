import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createStudySchema } from "@/lib/schemas/study";

// GET /api/studies — list studies for the authenticated admin
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const studies = await prisma.study.findMany({
    where: { createdBy: auth.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { responses: true, questions: true } },
    },
  });

  return NextResponse.json(studies);
});

// POST /api/studies — create a new study
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const data = createStudySchema.parse(body);

  const study = await prisma.study.create({
    data: {
      title: data.title,
      description: data.description,
      settings: data.settings ?? {},
      createdBy: auth.userId,
    },
  });

  return NextResponse.json(study, { status: 201 });
});
