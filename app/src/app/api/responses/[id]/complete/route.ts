import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/api/error-handler";

// POST /api/responses/[id]/complete — mark a response as completed
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;

    const respondentId = request.cookies.get("respondent_id")?.value;
    if (!respondentId) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const response = await prisma.response.findUnique({
      where: { id },
      select: {
        id: true,
        respondentId: true,
        status: true,
      },
    });

    if (!response || response.respondentId !== respondentId) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    if (response.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Response already finalized" },
        { status: 400 }
      );
    }

    const updated = await prisma.response.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  }
);
