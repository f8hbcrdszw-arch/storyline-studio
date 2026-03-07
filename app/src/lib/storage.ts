import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/webp"],
};

const MAX_FILE_SIZES: Record<string, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2GB
  image: 10 * 1024 * 1024, // 10MB
};

/**
 * Generates a presigned upload URL for direct client-to-R2 uploads.
 * Files are stored with UUID names to prevent path traversal.
 */
export async function createPresignedUpload(options: {
  contentType: string;
  mediaType: "video" | "image";
  originalFilename: string;
}) {
  const { contentType, mediaType, originalFilename } = options;

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES[mediaType]?.includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  // Generate UUID-based key (prevents path traversal from original filename)
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "bin";
  const key = `${mediaType}s/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: MAX_FILE_SIZES[mediaType],
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 30 * 60, // 30 minutes to complete upload
  });

  return { uploadUrl, key, maxSize: MAX_FILE_SIZES[mediaType] };
}

/**
 * Generates a short-lived signed URL for reading media.
 * 15-minute expiry as specified in security requirements.
 */
export async function createSignedReadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 15 * 60, // 15 minutes
  });
}
