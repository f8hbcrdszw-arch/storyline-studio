import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { z } from "zod";
import type { StudyStatus } from "@/generated/prisma/client";

const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["archive", "close", "delete"]),
  force: z.boolean().optional(),
});

// What steps are needed to reach the target status from any source status
const CHAIN: Record<string, Record<string, StudyStatus[]>> = {
  archive: {
    ACTIVE: ["CLOSED", "ARCHIVED"],
    PAUSED: ["CLOSED", "ARCHIVED"],
    CLOSED: ["ARCHIVED"],
    ARCHIVED: [],
  },
  close: {
    ACTIVE: ["CLOSED"],
    PAUSED: ["CLOSED"],
    CLOSED: [],
  },
  delete: {
    DRAFT: [],
  },
};

// POST /api/studies/batch — bulk action on multiple studies
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { ids, action, force } = batchSchema.parse(body);

  // Fetch all studies owned by this user
  const studies = await prisma.study.findMany({
    where: { id: { in: ids }, createdBy: auth.userId },
    select: { id: true, status: true },
  });

  const studyMap = new Map(studies.map((s) => [s.id, s]));
  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    const study = studyMap.get(id);

    if (!study) {
      results.push({ id, success: false, error: "Not found" });
      continue;
    }

    const chain = CHAIN[action]?.[study.status];

    // No valid path from this status
    if (chain === undefined) {
      results.push({
        id,
        success: false,
        error: `Cannot ${action} a ${study.status.toLowerCase()} study`,
      });
      continue;
    }

    // Already at target
    if (chain.length === 0) {
      results.push({ id, success: true });
      continue;
    }

    // Needs intermediate steps — only proceed if force is true
    if (chain.length > 1 && !force) {
      results.push({
        id,
        success: false,
        error: "requires_intermediate",
      });
      continue;
    }

    try {
      if (action === "delete") {
        await prisma.study.delete({ where: { id } });
      } else {
        // Apply each status transition in order
        for (const status of chain) {
          await prisma.study.update({
            where: { id },
            data: { status },
          });
        }
      }
      results.push({ id, success: true });
    } catch {
      results.push({ id, success: false, error: "Operation failed" });
    }
  }

  return NextResponse.json({ results });
});
