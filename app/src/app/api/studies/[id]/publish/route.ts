import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { randomBytes } from "crypto";

// POST /api/studies/[id]/publish — publish a draft study
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const study = await prisma.study.findUnique({
      where: { id, createdBy: auth.userId },
      select: {
        id: true,
        status: true,
        slug: true,
        _count: { select: { questions: true } },
      },
    });

    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    if (study.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft studies can be published" },
        { status: 400 }
      );
    }

    if (study._count.questions === 0) {
      return NextResponse.json(
        { error: "Cannot publish a study with no questions" },
        { status: 400 }
      );
    }

    // Generate a unique slug if one doesn't exist
    const slug = study.slug || randomBytes(6).toString("hex");

    const updated = await prisma.study.update({
      where: { id },
      data: {
        status: "ACTIVE",
        slug,
      },
    });

    const surveyUrl = `${request.nextUrl.origin}/survey/${slug}`;

    return NextResponse.json({
      ...updated,
      surveyUrl,
    });
  }
);
