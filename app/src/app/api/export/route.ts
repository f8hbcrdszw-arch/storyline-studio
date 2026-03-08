import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { buildStudyCsv } from "@/lib/csv-builder";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const createExportSchema = z.object({
  studyId: z.string().uuid(),
  type: z.enum(["CSV", "JSON", "VIDEO"]),
  config: z
    .object({
      segmentQuestionId: z.string().uuid().optional(),
      segmentValue: z.string().optional(),
    })
    .optional()
    .default({}),
});

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

// POST /api/export — create an export job
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: 10 exports per hour per admin
  const limited = await rateLimit(request, "export", {
    limit: 10,
    windowSecs: 3600,
  });
  if (limited) return limited;

  const body = createExportSchema.parse(await request.json());

  // Verify study ownership
  const study = await prisma.study.findFirst({
    where: { id: body.studyId, createdBy: auth.userId },
    select: { id: true, title: true },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  // For CSV and JSON, process inline (they're fast enough for serverless)
  // VIDEO exports would be queued for the Fly.io worker
  if (body.type === "VIDEO") {
    // Create a pending job for the background worker
    const job = await prisma.exportJob.create({
      data: {
        studyId: body.studyId,
        type: "VIDEO",
        status: "PENDING",
        config: body.config,
        createdBy: auth.userId,
      },
    });

    return NextResponse.json(
      { id: job.id, status: "PENDING", message: "Video export queued" },
      { status: 202 }
    );
  }

  // Process CSV/JSON inline
  const job = await prisma.exportJob.create({
    data: {
      studyId: body.studyId,
      type: body.type,
      status: "PROCESSING",
      config: body.config,
      createdBy: auth.userId,
    },
  });

  try {
    let content: string;
    let contentType: string;
    let extension: string;

    if (body.type === "CSV") {
      content = await buildStudyCsv(body.studyId);
      contentType = "text/csv";
      extension = "csv";
    } else {
      // JSON — NDJSON format
      content = await buildStudyJson(body.studyId);
      contentType = "application/x-ndjson";
      extension = "ndjson";
    }

    // Upload to R2
    const key = `exports/${job.id}/${sanitizeFilename(study.title)}.${extension}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: content,
        ContentType: contentType,
      })
    );

    // Generate a long-lived signed URL (24 hours)
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const resultUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 24 * 60 * 60 }
    );

    // Update job status
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        resultUrl,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: job.id,
      status: "COMPLETED",
      resultUrl,
    });
  } catch (err) {
    // Mark job as failed
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Unknown error",
      },
    });

    throw err;
  }
});

// GET /api/export — list export jobs for the authenticated user
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const studyId = request.nextUrl.searchParams.get("studyId");

  const jobs = await prisma.exportJob.findMany({
    where: {
      createdBy: auth.userId,
      ...(studyId ? { studyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      studyId: true,
      type: true,
      status: true,
      resultUrl: true,
      createdAt: true,
      completedAt: true,
      error: true,
    },
  });

  return NextResponse.json({ jobs });
});

async function buildStudyJson(studyId: string): Promise<string> {
  const responses = await prisma.response.findMany({
    where: { studyId, status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
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

  return responses.map((r) => JSON.stringify(r)).join("\n");
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
}
