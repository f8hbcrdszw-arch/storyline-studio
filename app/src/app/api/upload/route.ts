import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createPresignedUpload } from "@/lib/storage";
import { z } from "zod";

const uploadRequestSchema = z.object({
  contentType: z.string().min(1),
  mediaType: z.enum(["video", "image"]),
  filename: z.string().min(1).max(255),
});

// POST /api/upload — get a presigned URL for direct-to-R2 upload
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const data = uploadRequestSchema.parse(body);

  const result = await createPresignedUpload({
    contentType: data.contentType,
    mediaType: data.mediaType,
    originalFilename: data.filename,
  });

  return NextResponse.json(result, { status: 201 });
});
