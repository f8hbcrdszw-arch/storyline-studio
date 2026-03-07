import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type RespondentContext = {
  respondentId: string;
  studyId: string;
};

/**
 * Validates respondent_id cookie and verifies study is active.
 * No auth required — respondents are anonymous.
 */
export async function requireRespondent(
  request: NextRequest,
  studyId: string
): Promise<RespondentContext | NextResponse> {
  const respondentId = request.cookies.get("respondent_id")?.value;

  if (!respondentId) {
    return NextResponse.json(
      { error: "Missing respondent identifier" },
      { status: 400 }
    );
  }

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(respondentId)) {
    return NextResponse.json(
      { error: "Invalid respondent identifier" },
      { status: 400 }
    );
  }

  // Verify study exists and is active
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { status: true },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  if (study.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This survey is no longer accepting responses" },
      { status: 403 }
    );
  }

  return { respondentId, studyId };
}
